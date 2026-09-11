import { env } from "cloudflare:workers";
import { getD1 } from "../../../db";
import { ensureDatabase } from "../../../db/initialize";
import { authorize, getAppUser, scopedBlock } from "../../lib/auth";
import { BLOCKS, EVENT_ID } from "../../lib/constants";
import { HOMAM_CAPACITY, HOMAM_FEE, POOJA_REGISTRATION_TYPES, poojaDate, type PoojaType, validDailySlot } from "../../lib/pooja";
import { cleanText, isValidFlatNo, normalizeFlatNo, wholeNumber } from "../../lib/server";

const IMAGE_TYPES=new Set(["image/jpeg","image/png","image/webp"]);const MAX_PROOF_BYTES=1024*1024;
type Child={name:string;age:number};

export async function POST(request:Request){
  let proofKey="";
  try{
    const body=await request.formData();const type=cleanText(body.get("poojaType"),20) as PoojaType;
    const blockNo=cleanText(body.get("blockNo"),2).toUpperCase();const flatNo=normalizeFlatNo(body.get("flatNo"),blockNo);
    const residentName=cleanText(body.get("residentName"),120);const phone=cleanText(body.get("phone"),20).replace(/\D/g,"");
    const requestedDate=cleanText(body.get("poojaDate"),10);const session=cleanText(body.get("session"),12).toLowerCase();
    const attendeeCount=wholeNumber(body.get("attendeeCount"),1,20);const notes=cleanText(body.get("notes"),500);
    const paymentReference=cleanText(body.get("paymentReference"),80);const proof=body.get("paymentProof");
    let children:Child[]=[];try{const value=JSON.parse(cleanText(body.get("participantDetails"),3000));if(Array.isArray(value))children=value.map((item)=>({name:cleanText(item?.name,100),age:Number(item?.age)}));}catch{}
    if(!(POOJA_REGISTRATION_TYPES as readonly string[]).includes(type))return Response.json({error:"Choose a Pooja."},{status:400});
    if(!BLOCKS.includes(blockNo as never))return Response.json({error:"Choose your block."},{status:400});
    if(!isValidFlatNo(flatNo,blockNo))return Response.json({error:`Enter a valid Block ${blockNo} flat number. You may include the selected block letter.`},{status:400});
    if(!residentName)return Response.json({error:type==="homam"?"Enter the participating couple’s name(s).":"Enter the resident name."},{status:400});
    if(!/^\d{10}$/.test(phone))return Response.json({error:"Enter a valid 10-digit mobile number."},{status:400});
    const fixedDate=poojaDate(type);const poojaDateValue=type==="daily"?requestedDate:fixedDate;
    if(type==="daily"&&!validDailySlot(poojaDateValue,session))return Response.json({error:"Choose an available date and morning/evening session."},{status:400});
    if(type!=="daily"&&requestedDate&&requestedDate!==fixedDate)return Response.json({error:"The selected Pooja date is not valid."},{status:400});
    if(type==="saraswathi"&&(!children.length||children.length>10||children.some((child)=>!child.name||!Number.isInteger(child.age)||child.age<1||child.age>18)))return Response.json({error:"Add 1–10 children with valid names and ages."},{status:400});
    if(type!=="saraswathi"&&attendeeCount===null)return Response.json({error:"Enter an attendee count between 1 and 20."},{status:400});
    if(type==="homam"){
      if(!(proof instanceof File)||!proof.size)return Response.json({error:"Upload the Homam payment confirmation image."},{status:400});
      if(!IMAGE_TYPES.has(proof.type)||proof.size>MAX_PROOF_BYTES)return Response.json({error:"Upload a JPG, PNG or WebP payment image up to 1 MB."},{status:400});
    }
    const user=await getAppUser(request);const actor=user?.username??"resident-self-service";await ensureDatabase();const d1=getD1();
    const id=crypto.randomUUID();const referenceNo=`PJ26-${crypto.randomUUID().replaceAll("-","").slice(0,8).toUpperCase()}`;
    const proofStore=(env as unknown as {PAYMENT_PROOFS?:KVNamespace}).PAYMENT_PROOFS;
    if(type==="homam"&&proof instanceof File){if(!proofStore)throw new Error("Payment proof storage is unavailable.");proofKey=`${EVENT_ID}/pooja/${id}/${crypto.randomUUID()}`;await proofStore.put(proofKey,await proof.arrayBuffer(),{metadata:{originalName:proof.name,contentType:proof.type,uploadedBy:actor}});}
    const result=await d1.prepare(`INSERT INTO pooja_registrations
      (id,event_id,reference_no,pooja_type,pooja_date,session,block_no,flat_no,resident_name,phone,attendee_count,participant_details,payment_amount,payment_reference,payment_proof_key,payment_proof_name,payment_proof_type,payment_status,status,notes,created_by)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
      WHERE ?!='homam' OR (SELECT COUNT(*) FROM pooja_registrations WHERE event_id=? AND pooja_type='homam' AND status!='cancelled')<?`)
      .bind(id,EVENT_ID,referenceNo,type,poojaDateValue,type==="daily"?session:"",blockNo,flatNo,residentName,phone,type==="saraswathi"?children.length:type==="homam"?2:attendeeCount,JSON.stringify(children),type==="homam"?HOMAM_FEE:0,paymentReference,proofKey||null,proof instanceof File?proof.name:null,proof instanceof File?proof.type:null,type==="homam"?"pending":"not_required","submitted",notes,actor,type,EVENT_ID,HOMAM_CAPACITY).run();
    if(!result.meta.changes){if(proofKey)await proofStore?.delete(proofKey);return Response.json({error:"All 10 Homam slots have now been reserved."},{status:409});}
    await d1.prepare(`INSERT INTO audit_log(id,entity_type,entity_id,action,actor,details) VALUES(?,'pooja_registration',?,'submitted',?,?)`).bind(crypto.randomUUID(),id,actor,JSON.stringify({referenceNo,type,blockNo,flatNo,poojaDate:poojaDateValue,session})).run();
    return Response.json({ok:true,referenceNo,poojaType:type},{status:201});
  }catch(error){if(proofKey){const store=(env as unknown as {PAYMENT_PROOFS?:KVNamespace}).PAYMENT_PROOFS;await store?.delete(proofKey);}return Response.json({error:error instanceof Error?error.message:"Unable to save the Pooja registration."},{status:500});}
}

export async function GET(request:Request){
  const url=new URL(request.url);await ensureDatabase();
  if(url.searchParams.get("availability")==="homam"){
    const row=await getD1().prepare(`SELECT COUNT(*) count FROM pooja_registrations WHERE event_id=? AND pooja_type='homam' AND status!='cancelled'`).bind(EVENT_ID).first<{count:number}>();
    return Response.json({capacity:HOMAM_CAPACITY,booked:Number(row?.count??0),remaining:Math.max(0,HOMAM_CAPACITY-Number(row?.count??0)),fee:HOMAM_FEE});
  }
  const auth=await authorize(request,["admin","block"]);if("response" in auth)return auth.response;
  const block=scopedBlock(auth.user,url.searchParams.get("block"));const type=cleanText(url.searchParams.get("type"),20);await ensureDatabase();
  const rows=await getD1().prepare(`SELECT id,reference_no referenceNo,pooja_type poojaType,pooja_date poojaDate,session,block_no blockNo,flat_no flatNo,resident_name residentName,phone,attendee_count attendeeCount,participant_details participantDetails,payment_amount paymentAmount,payment_reference paymentReference,payment_proof_key IS NOT NULL hasProof,payment_status paymentStatus,status,notes,created_at createdAt FROM pooja_registrations WHERE event_id=? AND (?='' OR block_no=?) AND (?='' OR pooja_type=?) ORDER BY pooja_date,session,created_at`).bind(EVENT_ID,block,block,type,type).all();
  return Response.json({registrations:rows.results,user:auth.user});
}

export async function PATCH(request:Request){
  const auth=await authorize(request,["admin"]);if("response" in auth)return auth.response;const body=await request.json() as Record<string,unknown>;
  const id=cleanText(body.id,80);const status=cleanText(body.status,20);const paymentStatus=cleanText(body.paymentStatus,20);
  if(!id||(!status&&!paymentStatus)||(status&&!['submitted','confirmed','cancelled'].includes(status))||(paymentStatus&&!['pending','verified','rejected'].includes(paymentStatus)))return Response.json({error:"Choose a valid update."},{status:400});
  await ensureDatabase();const result=status?await getD1().prepare(`UPDATE pooja_registrations SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND event_id=?
    AND (?!='submitted' OR pooja_type!='homam' OR status!='cancelled' OR (SELECT COUNT(*) FROM pooja_registrations WHERE event_id=? AND pooja_type='homam' AND status!='cancelled')<?)`)
    .bind(status,id,EVENT_ID,status,EVENT_ID,HOMAM_CAPACITY).run():await getD1().prepare("UPDATE pooja_registrations SET payment_status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND event_id=? AND pooja_type='homam'").bind(paymentStatus,id,EVENT_ID).run();
  if(!result.meta.changes)return Response.json({error:"Registration not found."},{status:404});
  await getD1().prepare(`INSERT INTO audit_log(id,entity_type,entity_id,action,actor,details) VALUES(?,'pooja_registration',?,'status_updated',?,?)`).bind(crypto.randomUUID(),id,auth.user.username,JSON.stringify({status,paymentStatus})).run();return Response.json({ok:true});
}
