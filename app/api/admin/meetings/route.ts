import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { authorize } from "../../../lib/auth";
import { EVENT_ID } from "../../../lib/constants";
import { cleanText } from "../../../lib/server";

type ActionInput = { description?: unknown; owner?: unknown; dueDate?: unknown; priority?: unknown; status?: unknown; notes?: unknown };

function meetingValues(body: Record<string, unknown>) {
  const status = cleanText(body.status, 10);
  return {
    title: cleanText(body.title, 160), meetingDate: cleanText(body.meetingDate, 10),
    startTime: cleanText(body.startTime, 5), endTime: cleanText(body.endTime, 5), venue: cleanText(body.venue, 160),
    chairperson: cleanText(body.chairperson, 120), attendees: cleanText(body.attendees, 3000),
    absentees: cleanText(body.absentees, 2000), agenda: cleanText(body.agenda, 6000),
    discussion: cleanText(body.discussion, 12000), decisions: cleanText(body.decisions, 8000),
    nextMeetingDate: cleanText(body.nextMeetingDate, 10), status: ["draft", "final"].includes(status) ? status : "draft",
  };
}

function actionValues(value: ActionInput) {
  const priority = cleanText(value.priority, 10); const status = cleanText(value.status, 20);
  return { description: cleanText(value.description, 1000), owner: cleanText(value.owner, 160), dueDate: cleanText(value.dueDate, 10),
    priority: ["low", "medium", "high"].includes(priority) ? priority : "medium",
    status: ["open", "in_progress", "completed"].includes(status) ? status : "open", notes: cleanText(value.notes, 1000) };
}

async function listMeetings() {
  const d1 = getD1();
  const meetings = await d1.prepare(`SELECT id,title,meeting_date meetingDate,start_time startTime,end_time endTime,venue,
    chairperson,attendees,absentees,agenda,discussion,decisions,next_meeting_date nextMeetingDate,status,
    created_by createdBy,updated_by updatedBy,created_at createdAt,updated_at updatedAt
    FROM meeting_minutes WHERE event_id=? ORDER BY meeting_date DESC, created_at DESC`).bind(EVENT_ID).all<Record<string, unknown>>();
  const actions = await d1.prepare(`SELECT id,meeting_id meetingId,description,owner,due_date dueDate,priority,status,notes,sort_order sortOrder
    FROM meeting_action_items ORDER BY meeting_id,sort_order`).all<Record<string, unknown>>();
  const grouped = new Map<string, Record<string, unknown>[]>();
  for (const action of actions.results) { const key = String(action.meetingId); grouped.set(key, [...(grouped.get(key) ?? []), action]); }
  return meetings.results.map((meeting) => ({ ...meeting, actions: grouped.get(String(meeting.id)) ?? [] }));
}

export async function GET(request: Request) {
  const auth = await authorize(request, ["admin"]); if ("response" in auth) return auth.response;
  await ensureDatabase(); return Response.json({ meetings: await listMeetings() });
}

export async function POST(request: Request) {
  const auth = await authorize(request, ["admin"]); if ("response" in auth) return auth.response;
  const body = await request.json() as Record<string, unknown>; const meeting = meetingValues(body);
  if (!meeting.title || !/^\d{4}-\d{2}-\d{2}$/.test(meeting.meetingDate)) return Response.json({ error: "Meeting title and date are required." }, { status: 400 });
  const actions = Array.isArray(body.actions) ? body.actions.map((item) => actionValues(item as ActionInput)).filter((item) => item.description) : [];
  await ensureDatabase(); const d1 = getD1(); const id = crypto.randomUUID();
  const statements = [d1.prepare(`INSERT INTO meeting_minutes(id,event_id,title,meeting_date,start_time,end_time,venue,chairperson,attendees,absentees,agenda,discussion,decisions,next_meeting_date,status,created_by,updated_by)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,EVENT_ID,meeting.title,meeting.meetingDate,meeting.startTime,meeting.endTime,meeting.venue,meeting.chairperson,meeting.attendees,meeting.absentees,meeting.agenda,meeting.discussion,meeting.decisions,meeting.nextMeetingDate,meeting.status,auth.user.username,auth.user.username)];
  actions.forEach((item,index) => statements.push(d1.prepare(`INSERT INTO meeting_action_items(id,meeting_id,description,owner,due_date,priority,status,notes,sort_order) VALUES(?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),id,item.description,item.owner,item.dueDate,item.priority,item.status,item.notes,index)));
  statements.push(d1.prepare(`INSERT INTO audit_log(id,entity_type,entity_id,action,actor,details) VALUES(?,'meeting_minutes',?,'created',?,?)`).bind(crypto.randomUUID(),id,auth.user.username,JSON.stringify({ title: meeting.title })));
  await d1.batch(statements); return Response.json({ id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await authorize(request, ["admin"]); if ("response" in auth) return auth.response;
  const body = await request.json() as Record<string, unknown>; const id = cleanText(body.id, 80); const meeting = meetingValues(body);
  if (!id || !meeting.title || !/^\d{4}-\d{2}-\d{2}$/.test(meeting.meetingDate)) return Response.json({ error: "Meeting title and date are required." }, { status: 400 });
  const actions = Array.isArray(body.actions) ? body.actions.map((item) => actionValues(item as ActionInput)).filter((item) => item.description) : [];
  await ensureDatabase(); const d1 = getD1(); const existing = await d1.prepare("SELECT id FROM meeting_minutes WHERE id=? AND event_id=?").bind(id,EVENT_ID).first();
  if (!existing) return Response.json({ error: "Meeting not found." }, { status: 404 });
  const statements = [d1.prepare(`UPDATE meeting_minutes SET title=?,meeting_date=?,start_time=?,end_time=?,venue=?,chairperson=?,attendees=?,absentees=?,agenda=?,discussion=?,decisions=?,next_meeting_date=?,status=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(meeting.title,meeting.meetingDate,meeting.startTime,meeting.endTime,meeting.venue,meeting.chairperson,meeting.attendees,meeting.absentees,meeting.agenda,meeting.discussion,meeting.decisions,meeting.nextMeetingDate,meeting.status,auth.user.username,id), d1.prepare("DELETE FROM meeting_action_items WHERE meeting_id=?").bind(id)];
  actions.forEach((item,index) => statements.push(d1.prepare(`INSERT INTO meeting_action_items(id,meeting_id,description,owner,due_date,priority,status,notes,sort_order) VALUES(?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),id,item.description,item.owner,item.dueDate,item.priority,item.status,item.notes,index)));
  statements.push(d1.prepare(`INSERT INTO audit_log(id,entity_type,entity_id,action,actor) VALUES(?,'meeting_minutes',?,'updated',?)`).bind(crypto.randomUUID(),id,auth.user.username));
  await d1.batch(statements); return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await authorize(request, ["admin"]); if ("response" in auth) return auth.response;
  const id = cleanText(new URL(request.url).searchParams.get("id"), 80); if (!id) return Response.json({ error: "Meeting id required." }, { status: 400 });
  await ensureDatabase(); const d1 = getD1(); await d1.batch([d1.prepare("DELETE FROM meeting_action_items WHERE meeting_id=?").bind(id),d1.prepare("DELETE FROM meeting_minutes WHERE id=? AND event_id=?").bind(id,EVENT_ID),d1.prepare(`INSERT INTO audit_log(id,entity_type,entity_id,action,actor) VALUES(?,'meeting_minutes',?,'deleted',?)`).bind(crypto.randomUUID(),id,auth.user.username)]);
  return Response.json({ ok: true });
}
