import { env } from "cloudflare:workers";
import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { authorize } from "../../../lib/auth";
import { cleanText, wholeNumber } from "../../../lib/server";
import { EVENT_ID, MINIMUM_DONATION } from "../../../lib/constants";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PROOF_BYTES = 1024 * 1024;

async function scopedRegistration(id:string,user:{role:string;blockNo:string|null}) {
  const row=await getD1().prepare(`SELECT id,block_no blockNo,status FROM registrations WHERE id=? AND event_id=?`).bind(id,EVENT_ID).first<{id:string;blockNo:string;status:string}>();
  return row && (user.role === "admin" || row.blockNo === user.blockNo) ? row : null;
}
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  const auth=await authorize(request); if("response" in auth)return auth.response; await ensureDatabase(); const {id}=await params;
  if(!await scopedRegistration(id,auth.user)) return Response.json({error:"Donation not found."},{status:404});
  const registration=await getD1().prepare(`SELECT id,reference_no referenceNo,resident_name residentName,block_no blockNo,
    flat_no flatNo,gotram,occupancy,phone,adult_count adultCount,child_count childCount,notes,status,created_at createdAt
    FROM registrations WHERE id=?`).bind(id).first();
  const donations=await getD1().prepare(`SELECT id,category,amount,payment_method paymentMethod,payment_reference paymentReference,
    status,payment_proof_key IS NOT NULL hasProof FROM donations WHERE registration_id=?`).bind(id).all();
  return Response.json({registration,donations:donations.results});
}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
  const auth=await authorize(request); if("response" in auth)return auth.response; await ensureDatabase(); const {id}=await params;
  const current=await scopedRegistration(id,auth.user); if(!current)return Response.json({error:"Donation not found."},{status:404});
  if(auth.user.role === "block" && !["submitted","correction_requested"].includes(current.status)) return Response.json({error:"Verified donations can only be changed by an admin."},{status:403});
  const body=await request.formData(); const amount=wholeNumber(body.get("mainDonation"),MINIMUM_DONATION);
  const idolDonation=wholeNumber(body.get("idolDonation"),0); const annadaanamDonation=wholeNumber(body.get("annadaanamDonation"),0);
  const paymentReference=cleanText(body.get("paymentReference"),80); const adults=wholeNumber(body.get("adultCount"),0,7); const children=wholeNumber(body.get("childCount"),0,7); const notes=cleanText(body.get("notes"),500);
  const proofEntry=body.get("paymentProof"); const proof=proofEntry instanceof File&&proofEntry.size>0?proofEntry:null;
  if(amount===null||idolDonation===null||annadaanamDonation===null||adults===null||children===null)return Response.json({error:"Complete all required update fields."},{status:400});
  if(proof&&(!IMAGE_TYPES.has(proof.type)||proof.size>MAX_PROOF_BYTES))return Response.json({error:"Upload a JPG, PNG or WebP payment image up to 1 MB."},{status:400});
  const d1=getD1();
  const existingRows=await d1.prepare(`SELECT id,category,payment_proof_key proofKey FROM donations WHERE registration_id=?`).bind(id).all<{id:string;category:string;proofKey:string|null}>();
  const existing=existingRows.results.find((donation)=>donation.category==="festival");
  if(!existing)return Response.json({error:"Donation not found."},{status:404});
  const proofStore=(env as unknown as {PAYMENT_PROOFS?:KVNamespace}).PAYMENT_PROOFS;
  if(proof&&!proofStore)return Response.json({error:"Private proof storage is unavailable."},{status:503});
  const newProofKey=proof?`${EVENT_ID}/${current.blockNo}/${id}/${crypto.randomUUID()}`:null;
  if(proof&&newProofKey)await proofStore!.put(newProofKey,await proof.arrayBuffer(),{metadata:{originalName:proof.name,contentType:proof.type,uploadedBy:auth.user.username}});
  const resubmitted=current.status==="correction_requested";
  try {
    const statements=[
      d1.prepare(`UPDATE registrations SET adult_count=?,child_count=?,notes=?,status=CASE WHEN status='correction_requested' THEN 'submitted' ELSE status END,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(adults,children,notes,id),
      proof
        ? d1.prepare(`UPDATE donations SET amount=?,payment_proof_key=?,payment_proof_name=?,payment_proof_type=? WHERE registration_id=? AND category='festival'`).bind(amount,newProofKey,proof.name,proof.type,id)
        : d1.prepare(`UPDATE donations SET amount=? WHERE registration_id=? AND category='festival'`).bind(amount,id),
      d1.prepare(`UPDATE donations SET payment_reference=?,status=CASE WHEN status='verified' THEN status ELSE 'pending' END WHERE registration_id=?`).bind(paymentReference,id),
      d1.prepare(`INSERT INTO audit_log(id,entity_type,entity_id,action,actor,details) VALUES (?,'registration',?,?,?,?)`).bind(crypto.randomUUID(),id,resubmitted?"resubmitted":"updated",auth.user.username,JSON.stringify({amount,idolDonation,annadaanamDonation,replacedProof:Boolean(proof)})),
    ];
    const additionalDonations=[{category:"idol",amount:idolDonation},{category:"annadaanam",amount:annadaanamDonation}];
    for(const additional of additionalDonations){
      const row=existingRows.results.find((donation)=>donation.category===additional.category);
      if(row)statements.push(d1.prepare(`UPDATE donations SET amount=? WHERE id=? AND registration_id=?`).bind(additional.amount,row.id,id));
      else if(additional.amount>0){
        const status=current.status==="verified"?"verified":"pending";
        statements.push(d1.prepare(`INSERT INTO donations(id,registration_id,category,amount,payment_method,payment_reference,status,verified_at,verified_by)
          VALUES(?,?,?,?,'upi',?,?,CASE WHEN ?='verified' THEN CURRENT_TIMESTAMP ELSE NULL END,?)`)
          .bind(crypto.randomUUID(),id,additional.category,additional.amount,paymentReference,status,status,status==="verified"?auth.user.username:null));
      }
    }
    await d1.batch(statements);
  } catch(error) {
    if(newProofKey)await proofStore?.delete(newProofKey);
    return Response.json({error:error instanceof Error?error.message:"Could not update donation."},{status:500});
  }
  if(newProofKey&&existing.proofKey&&existing.proofKey!==newProofKey)await proofStore?.delete(existing.proofKey).catch(()=>undefined);
  return Response.json({ok:true,resubmitted});
}

export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}) {
  const auth=await authorize(request,["admin"]);if("response" in auth)return auth.response;await ensureDatabase();const{id}=await params;const d1=getD1();
  const registration=await d1.prepare(`SELECT id,reference_no referenceNo,resident_name residentName,block_no blockNo,flat_no flatNo,status FROM registrations WHERE id=? AND event_id=? AND status!='cancelled'`).bind(id,EVENT_ID).first<{id:string;referenceNo:string;residentName:string;blockNo:string;flatNo:string;status:string}>();
  if(!registration)return Response.json({error:"Donation not found."},{status:404});
  const [donationRows,flat,otherActive]=await Promise.all([
    d1.prepare("SELECT id,status FROM donations WHERE registration_id=?").bind(id).all<{id:string;status:string}>(),
    d1.prepare("SELECT visit_status visitStatus FROM flats WHERE event_id=? AND block_no=? AND flat_no=?").bind(EVENT_ID,registration.blockNo,registration.flatNo).first<{visitStatus:string}>(),
    d1.prepare(`SELECT COUNT(*) count FROM registrations WHERE event_id=? AND block_no=? AND flat_no=? AND id!=? AND status!='cancelled'`).bind(EVENT_ID,registration.blockNo,registration.flatNo,id).first<{count:number}>(),
  ]);
  const restoreData={registrationStatus:registration.status,donations:donationRows.results,flatVisitStatus:flat?.visitStatus??"pending"};
  const statements=[
    d1.prepare("UPDATE registrations SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE id=? AND event_id=?").bind(id,EVENT_ID),
    d1.prepare("UPDATE donations SET status='reversed' WHERE registration_id=?").bind(id),
    d1.prepare(`INSERT INTO recycle_bin(id,event_id,entity_type,entity_id,entity_label,restore_data,deleted_by) VALUES(?,?,'registration',?,?,?,?)`).bind(crypto.randomUUID(),EVENT_ID,id,`${registration.referenceNo} · ${registration.residentName} · ${registration.blockNo}-${registration.flatNo}`,JSON.stringify(restoreData),auth.user.username),
    d1.prepare(`INSERT INTO audit_log(id,entity_type,entity_id,action,actor,details) VALUES(?,'registration',?,'moved_to_recycle_bin',?,'{}')`).bind(crypto.randomUUID(),id,auth.user.username),
  ];
  if(!Number(otherActive?.count??0))statements.push(d1.prepare("UPDATE flats SET visit_status='pending',updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE event_id=? AND block_no=? AND flat_no=?").bind(auth.user.username,EVENT_ID,registration.blockNo,registration.flatNo));
  await d1.batch(statements);
  return Response.json({ok:true,recycled:true});
}
