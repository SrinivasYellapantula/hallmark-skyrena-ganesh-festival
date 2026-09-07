import { getD1 } from "../../../../../db";
import { ensureDatabase } from "../../../../../db/initialize";
import { authorize } from "../../../../lib/auth";
import { EVENT_ID } from "../../../../lib/constants";
import { cleanText } from "../../../../lib/server";

const OUTCOMES = new Set(["genuine_owner_tenant", "genuine_separate_donations", "actual_duplicate", "needs_review"]);

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  const auth=await authorize(request); if("response" in auth)return auth.response; await ensureDatabase();
  const {id}=await params; const body=await request.json() as {outcome?:unknown;note?:unknown};
  const outcome=cleanText(body.outcome,40); const note=cleanText(body.note,300);
  if(!OUTCOMES.has(outcome))return Response.json({error:"Choose a valid duplicate-review outcome."},{status:400});
  const registration=await getD1().prepare(`SELECT block_no blockNo FROM registrations WHERE id=? AND event_id=? AND status!='cancelled'`).bind(id,EVENT_ID).first<{blockNo:string}>();
  if(!registration||(auth.user.role==="block"&&registration.blockNo!==auth.user.blockNo))return Response.json({error:"Donation record not found."},{status:404});
  await getD1().prepare(`INSERT INTO audit_log(id,entity_type,entity_id,action,actor,details) VALUES(?,'registration',?,'duplicate_reviewed',?,?)`)
    .bind(crypto.randomUUID(),id,auth.user.username,JSON.stringify({outcome,note})).run();
  return Response.json({ok:true,outcome});
}
