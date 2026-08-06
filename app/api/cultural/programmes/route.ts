import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { authorize } from "../../../lib/auth";
import { BLOCKS, EVENT_ID } from "../../../lib/constants";
import { cleanText, wholeNumber } from "../../../lib/server";

function values(body: Record<string, unknown>) {
  const status = cleanText(body.status, 20); const blockNo = cleanText(body.blockNo, 2).toUpperCase();
  return { title: cleanText(body.title, 160), category: cleanText(body.category, 80), participantDetails: cleanText(body.participantDetails, 2000), coordinator: cleanText(body.coordinator, 160), blockNo: BLOCKS.includes(blockNo as never) ? blockNo : "", flatNo: cleanText(body.flatNo, 20).toUpperCase(), programmeDate: cleanText(body.programmeDate, 10), startTime: cleanText(body.startTime, 5), durationMinutes: wholeNumber(body.durationMinutes, 1, 240) ?? 10, status: ["proposed","confirmed","completed","cancelled"].includes(status) ? status : "proposed", notes: cleanText(body.notes, 3000) };
}

export async function GET(request: Request) {
  const auth=await authorize(request,["admin","cultural"]); if("response" in auth)return auth.response; await ensureDatabase();
  const rows=await getD1().prepare(`SELECT id,title,category,participant_details participantDetails,coordinator,block_no blockNo,flat_no flatNo,programme_date programmeDate,start_time startTime,duration_minutes durationMinutes,status,notes,created_by createdBy,created_at createdAt FROM cultural_programmes WHERE event_id=? ORDER BY CASE WHEN programme_date='' THEN 1 ELSE 0 END,programme_date,start_time,title`).bind(EVENT_ID).all();
  return Response.json({ programmes: rows.results, user: auth.user });
}

export async function POST(request: Request) {
  const auth=await authorize(request,["admin","cultural"]); if("response" in auth)return auth.response; const body=await request.json() as Record<string,unknown>; const item=values(body);
  if(!item.title||!item.category)return Response.json({error:"Programme name and category are required."},{status:400}); await ensureDatabase(); const id=crypto.randomUUID();
  await getD1().prepare(`INSERT INTO cultural_programmes(id,event_id,title,category,participant_details,coordinator,block_no,flat_no,programme_date,start_time,duration_minutes,status,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,EVENT_ID,item.title,item.category,item.participantDetails,item.coordinator,item.blockNo,item.flatNo,item.programmeDate,item.startTime,item.durationMinutes,item.status,item.notes,auth.user.username).run(); return Response.json({id},{status:201});
}

export async function PATCH(request: Request) {
  const auth=await authorize(request,["admin","cultural"]); if("response" in auth)return auth.response; const body=await request.json() as Record<string,unknown>; const id=cleanText(body.id,80); const item=values(body);
  if(!id||!item.title||!item.category)return Response.json({error:"Programme name and category are required."},{status:400}); await ensureDatabase();
  await getD1().prepare(`UPDATE cultural_programmes SET title=?,category=?,participant_details=?,coordinator=?,block_no=?,flat_no=?,programme_date=?,start_time=?,duration_minutes=?,status=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND event_id=?`).bind(item.title,item.category,item.participantDetails,item.coordinator,item.blockNo,item.flatNo,item.programmeDate,item.startTime,item.durationMinutes,item.status,item.notes,id,EVENT_ID).run(); return Response.json({ok:true});
}

export async function DELETE(request: Request) {
  const auth=await authorize(request,["admin","cultural"]); if("response" in auth)return auth.response; const id=cleanText(new URL(request.url).searchParams.get("id"),80); if(!id)return Response.json({error:"Programme id required."},{status:400}); await ensureDatabase(); await getD1().prepare("DELETE FROM cultural_programmes WHERE id=? AND event_id=?").bind(id,EVENT_ID).run(); return Response.json({ok:true});
}
