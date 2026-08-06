import { env } from "cloudflare:workers";
import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { authorize, isPortalOwner } from "../../../lib/auth";
import { EVENT_ID } from "../../../lib/constants";
import { cleanText } from "../../../lib/server";

type TrashRow={id:string;entityType:"expense"|"meeting"|"registration";entityId:string;entityLabel:string;restoreData:string;deletedBy:string;deletedAt:string;ageDays:number};

async function owner(request:Request){
  const auth=await authorize(request,["admin"]);if("response" in auth)return auth;
  if(!isPortalOwner(auth.user))return{response:Response.json({error:"Portal Admin access required."},{status:403})} as const;
  return auth;
}

export async function GET(request:Request){
  const auth=await owner(request);if("response" in auth)return auth.response;await ensureDatabase();
  const rows=await getD1().prepare(`SELECT id,entity_type entityType,entity_id entityId,entity_label entityLabel,
    restore_data restoreData,deleted_by deletedBy,deleted_at deletedAt,
    CAST(julianday('now')-julianday(deleted_at) AS INTEGER) ageDays
    FROM recycle_bin WHERE event_id=? AND status='active' ORDER BY deleted_at DESC`).bind(EVENT_ID).all();
  return Response.json({items:rows.results});
}

export async function PATCH(request:Request){
  const auth=await owner(request);if("response" in auth)return auth.response;const body=await request.json() as Record<string,unknown>;const id=cleanText(body.id,80);
  if(!id)return Response.json({error:"Recycle Bin item required."},{status:400});await ensureDatabase();const d1=getD1();
  const row=await d1.prepare(`SELECT id,entity_type entityType,entity_id entityId,entity_label entityLabel,restore_data restoreData,deleted_by deletedBy,deleted_at deletedAt,0 ageDays FROM recycle_bin WHERE id=? AND event_id=? AND status='active'`).bind(id,EVENT_ID).first<TrashRow>();
  if(!row)return Response.json({error:"Recycle Bin item not found."},{status:404});const data=parseRestoreData(row.restoreData);const statements=[];
  if(row.entityType==="expense"){
    if(!await d1.prepare("SELECT id FROM expenses WHERE id=? AND event_id=?").bind(row.entityId,EVENT_ID).first())return Response.json({error:"The expense no longer exists and cannot be restored."},{status:409});
    const status=["draft","approved"].includes(String(data.status))?String(data.status):"approved";statements.push(d1.prepare("UPDATE expenses SET status=? WHERE id=? AND event_id=?").bind(status,row.entityId,EVENT_ID));
  }else if(row.entityType==="meeting"){
    if(!await d1.prepare("SELECT id FROM meeting_minutes WHERE id=? AND event_id=?").bind(row.entityId,EVENT_ID).first())return Response.json({error:"The meeting no longer exists and cannot be restored."},{status:409});
    const status=["draft","final"].includes(String(data.status))?String(data.status):"draft";statements.push(d1.prepare("UPDATE meeting_minutes SET status=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND event_id=?").bind(status,auth.user.username,row.entityId,EVENT_ID));
  }else{
    const registration=await d1.prepare("SELECT block_no blockNo,flat_no flatNo FROM registrations WHERE id=? AND event_id=?").bind(row.entityId,EVENT_ID).first<{blockNo:string;flatNo:string}>();
    if(!registration)return Response.json({error:"The donation no longer exists and cannot be restored."},{status:409});
    const status=["submitted","verified","correction_requested"].includes(String(data.registrationStatus))?String(data.registrationStatus):"submitted";
    statements.push(d1.prepare("UPDATE registrations SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND event_id=?").bind(status,row.entityId,EVENT_ID));
    const donations=Array.isArray(data.donations)?data.donations as Array<{id?:unknown;status?:unknown}>:[];
    for(const donation of donations){const donationId=cleanText(donation.id,80);const donationStatus=["pending","verified"].includes(String(donation.status))?String(donation.status):"pending";if(donationId)statements.push(d1.prepare("UPDATE donations SET status=? WHERE id=? AND registration_id=?").bind(donationStatus,donationId,row.entityId));}
    statements.push(d1.prepare("UPDATE flats SET visit_status='donated',updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE event_id=? AND block_no=? AND flat_no=?").bind(auth.user.username,EVENT_ID,registration.blockNo,registration.flatNo));
  }
  statements.push(d1.prepare("UPDATE recycle_bin SET status='restored',restored_by=?,restored_at=CURRENT_TIMESTAMP WHERE id=?").bind(auth.user.username,id));
  statements.push(d1.prepare(`INSERT INTO audit_log(id,entity_type,entity_id,action,actor,details) VALUES(?,?,?,'restored_from_recycle_bin',?,'{}')`).bind(crypto.randomUUID(),row.entityType,row.entityId,auth.user.username));
  await d1.batch(statements);return Response.json({ok:true});
}

export async function DELETE(request:Request){
  const auth=await owner(request);if("response" in auth)return auth.response;const body=await request.json() as Record<string,unknown>;const id=cleanText(body.id,80);await ensureDatabase();const d1=getD1();
  const row=await d1.prepare(`SELECT id,entity_type entityType,entity_id entityId,entity_label entityLabel,restore_data restoreData,deleted_by deletedBy,deleted_at deletedAt,CAST(julianday('now')-julianday(deleted_at) AS INTEGER) ageDays FROM recycle_bin WHERE id=? AND event_id=? AND status='active'`).bind(id,EVENT_ID).first<TrashRow>();
  if(!row)return Response.json({error:"Recycle Bin item not found."},{status:404});if(Number(row.ageDays)<30)return Response.json({error:`Permanent deletion becomes available after 30 days. ${30-Number(row.ageDays)} day(s) remaining.`},{status:409});
  const expected=`DELETE ${row.entityLabel}`;if(cleanText(body.confirmation,500)!==expected)return Response.json({error:`Type ${expected} to confirm.`},{status:400});
  const storedKeys:string[]=[];const statements=[];
  if(row.entityType==="expense"){
    const expense=await d1.prepare("SELECT receipt_proof_key proofKey FROM expenses WHERE id=? AND event_id=?").bind(row.entityId,EVENT_ID).first<{proofKey:string|null}>();if(expense?.proofKey)storedKeys.push(expense.proofKey);statements.push(d1.prepare("DELETE FROM expenses WHERE id=? AND event_id=?").bind(row.entityId,EVENT_ID));
  }else if(row.entityType==="meeting"){
    statements.push(d1.prepare("DELETE FROM meeting_action_items WHERE meeting_id=?").bind(row.entityId),d1.prepare("DELETE FROM meeting_minutes WHERE id=? AND event_id=?").bind(row.entityId,EVENT_ID));
  }else{
    const proofs=await d1.prepare("SELECT payment_proof_key proofKey FROM donations WHERE registration_id=? AND payment_proof_key IS NOT NULL").bind(row.entityId).all<{proofKey:string}>();storedKeys.push(...proofs.results.map((item)=>item.proofKey));statements.push(d1.prepare("DELETE FROM donations WHERE registration_id=?").bind(row.entityId),d1.prepare("DELETE FROM registrations WHERE id=? AND event_id=?").bind(row.entityId,EVENT_ID));
  }
  statements.push(d1.prepare("DELETE FROM recycle_bin WHERE id=?").bind(id),d1.prepare(`INSERT INTO audit_log(id,entity_type,entity_id,action,actor,details) VALUES(?,?,?,'permanently_deleted',?,?)`).bind(crypto.randomUUID(),row.entityType,row.entityId,auth.user.username,JSON.stringify({label:row.entityLabel})));
  await d1.batch(statements);const proofStore=(env as unknown as{PAYMENT_PROOFS?:KVNamespace}).PAYMENT_PROOFS;await Promise.all(storedKeys.map((key)=>proofStore?.delete(key).catch(()=>undefined)));return Response.json({ok:true});
}

function parseRestoreData(value:string){try{return JSON.parse(value) as Record<string,unknown>;}catch{return{};}}
