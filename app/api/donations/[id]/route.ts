import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { authorize } from "../../../lib/auth";
import { cleanText, wholeNumber } from "../../../lib/server";
import { MINIMUM_DONATION } from "../../../lib/constants";

async function scopedRegistration(id:string,user:{role:string;blockNo:string|null}) {
  const row=await getD1().prepare(`SELECT id,block_no blockNo,status FROM registrations WHERE id=?`).bind(id).first<{id:string;blockNo:string;status:string}>();
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
  if(auth.user.role === "block" && current.status !== "submitted") return Response.json({error:"Verified donations can only be changed by an admin."},{status:403});
  const body=await request.json() as Record<string,unknown>; const amount=wholeNumber(body.mainDonation,MINIMUM_DONATION);
  const paymentReference=cleanText(body.paymentReference,80); const adults=wholeNumber(body.adultCount,0,7); const children=wholeNumber(body.childCount,0,7); const notes=cleanText(body.notes,500);
  if(amount===null||!paymentReference||adults===null||children===null)return Response.json({error:"Complete all update fields."},{status:400});
  const d1=getD1(); await d1.batch([
    d1.prepare(`UPDATE registrations SET adult_count=?,child_count=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(adults,children,notes,id),
    d1.prepare(`UPDATE donations SET amount=?,payment_reference=? WHERE registration_id=? AND category='festival'`).bind(amount,paymentReference,id),
    d1.prepare(`INSERT INTO audit_log(id,entity_type,entity_id,action,actor,details) VALUES (?,'registration',?,'updated',?,?)`).bind(crypto.randomUUID(),id,auth.user.username,JSON.stringify({amount}))
  ]); return Response.json({ok:true});
}
