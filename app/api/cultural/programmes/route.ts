import { env } from "cloudflare:workers";
import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { getAppUser, authorize, isPortalOwner } from "../../../lib/auth";
import { BLOCKS, EVENT_ID } from "../../../lib/constants";
import { CULTURAL_CATEGORIES, CULTURAL_STATUSES } from "../../../lib/cultural";
import { cleanText, isValidFlatNo, normalizeFlatNo, wholeNumber } from "../../../lib/server";

const AUDIO_TYPES = new Set(["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/wave", "audio/x-wav"]);
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

type Participant = { name: string; age: number; blockNo: string; flatNo: string };

function parseParticipants(value: FormDataEntryValue | null): Participant[] | null {
  try {
    const input = JSON.parse(String(value ?? "[]")) as Array<Record<string, unknown>>;
    if (!Array.isArray(input) || input.length < 1 || input.length > 30) return null;
    const participants = input.map((item) => {
      const blockNo = cleanText(item.blockNo, 2).toUpperCase();
      const flatNo = normalizeFlatNo(item.flatNo, blockNo);
      return { name: cleanText(item.name, 100), age: wholeNumber(item.age, 1, 100) ?? 0, blockNo, flatNo };
    });
    return participants.every((item) => item.name && item.age && BLOCKS.includes(item.blockNo as never) && isValidFlatNo(item.flatNo, item.blockNo)) ? participants : null;
  } catch { return null; }
}

export async function GET(request: Request) {
  const auth = await authorize(request,["admin","cultural"]);
  if ("response" in auth) return auth.response;
  await ensureDatabase();
  const rows = await getD1().prepare(`SELECT id,reference_no referenceNo,title,performance_type performanceType,
    category,participant_details participantDetails,coordinator,contact_name contactName,contact_phone contactPhone,
    block_no blockNo,flat_no flatNo,programme_date programmeDate,start_time startTime,duration_minutes durationMinutes,
    status,background_music backgroundMusic,audio_key IS NOT NULL hasAudio,audio_name audioName,
    stage_requirements stageRequirements,props_requirements propsRequirements,setup_minutes setupMinutes,
    source,created_by createdBy,created_at createdAt
    FROM cultural_programmes WHERE event_id=? AND status<>'recycled'
    ORDER BY CASE status WHEN 'scheduled' THEN 0 WHEN 'approved' THEN 1 WHEN 'under_review' THEN 2
      WHEN 'submitted' THEN 3 WHEN 'clarification_required' THEN 4 WHEN 'waitlisted' THEN 5
      WHEN 'completed' THEN 6 ELSE 7 END,
      CASE WHEN programme_date='' THEN 1 ELSE 0 END,programme_date,start_time,created_at DESC`).bind(EVENT_ID).all();
  return Response.json({ programmes: rows.results, user: { ...auth.user, portalOwner: isPortalOwner(auth.user) } });
}

export async function POST(request: Request) {
  const user = await getAppUser(request);
  const body = await request.formData();
  const performanceType = cleanText(body.get("performanceType"), 10).toLowerCase();
  const category = cleanText(body.get("category"), 80);
  const title = cleanText(body.get("title"), 160);
  const participants = parseParticipants(body.get("participantDetails"));
  const contactName = cleanText(body.get("contactName"), 100);
  const contactPhone = cleanText(body.get("contactPhone"), 20).replace(/\D/g, "");
  const durationMinutes = wholeNumber(body.get("durationMinutes"), 1, 30);
  const backgroundMusic = body.get("backgroundMusic") === "true";
  const stageRequirements = cleanText(body.get("stageRequirements"), 1000);
  const propsRequirements = cleanText(body.get("propsRequirements"), 1000);
  const setupMinutes = 0;
  const audio = body.get("audioTrack");

  if (!["solo", "group"].includes(performanceType)) return Response.json({ error: "Choose Solo or Group." }, { status: 400 });
  if (!CULTURAL_CATEGORIES.includes(category as never)) return Response.json({ error: "Choose a valid performance category." }, { status: 400 });
  if (!title) return Response.json({ error: "Enter the performance title." }, { status: 400 });
  if (!participants) return Response.json({ error: "Enter a valid name, age, block and flat number for every participant." }, { status: 400 });
  if (performanceType === "solo" && participants.length !== 1) return Response.json({ error: "A solo entry must contain one participant." }, { status: 400 });
  if (performanceType === "group" && participants.length < 2) return Response.json({ error: "Add at least two participants for a group entry." }, { status: 400 });
  if (!contactName || !/^\d{10}$/.test(contactPhone)) return Response.json({ error: "Enter the contact person's name and a valid 10-digit mobile number." }, { status: 400 });
  if (durationMinutes === null) return Response.json({ error: "Enter a valid duration." }, { status: 400 });
  const hasAudio = audio instanceof File && audio.size > 0;
  if (hasAudio && (!AUDIO_TYPES.has(audio.type) || audio.size > MAX_AUDIO_BYTES))
    return Response.json({ error: "Upload an MP3, M4A or WAV audio track up to 8 MB." }, { status: 400 });

  await ensureDatabase();
  const d1 = getD1();
  const id = crypto.randomUUID();
  const referenceNo = `CP26-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
  const actor = user?.username ?? "resident-self-service";
  const source = user ? "volunteer" : "resident";
  let audioKey: string | null = null;
  const proofStore = (env as unknown as { PAYMENT_PROOFS?: KVNamespace }).PAYMENT_PROOFS;
  if (hasAudio) {
    if (!proofStore) return Response.json({ error: "Audio storage is temporarily unavailable." }, { status: 503 });
    audioKey = `${EVENT_ID}/cultural/${id}/${crypto.randomUUID()}`;
    await proofStore.put(audioKey, await audio.arrayBuffer(), { metadata: { originalName: audio.name, contentType: audio.type, uploadedBy: actor } });
  }
  try {
    const first = participants[0];
    await d1.batch([
      d1.prepare(`INSERT INTO cultural_programmes
        (id,event_id,reference_no,title,performance_type,category,participant_details,coordinator,
         contact_name,contact_phone,block_no,flat_no,duration_minutes,status,background_music,
         audio_key,audio_name,audio_type,stage_requirements,props_requirements,setup_minutes,source,created_by)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'submitted',?,?,?,?,?,?,?,?,?)`)
        .bind(id,EVENT_ID,referenceNo,title,performanceType,category,JSON.stringify(participants),"",
          contactName,contactPhone,first.blockNo,first.flatNo,durationMinutes,backgroundMusic ? 1 : 0,
          audioKey,hasAudio ? audio.name : null,hasAudio ? audio.type : null,stageRequirements,propsRequirements,
          setupMinutes,source,actor),
      d1.prepare(`INSERT INTO audit_log(id,entity_type,entity_id,action,actor,details)
        VALUES(?,'cultural_programme',?,'submitted',?,?)`)
        .bind(crypto.randomUUID(),id,actor,JSON.stringify({referenceNo,source,performanceType,category,participantCount:participants.length})),
    ]);
    return Response.json({ referenceNo }, { status: 201 });
  } catch (error) {
    if (audioKey) await proofStore?.delete(audioKey);
    throw error;
  }
}

export async function PATCH(request: Request) {
  const auth = await authorize(request,["admin","cultural"]);
  if ("response" in auth) return auth.response;
  const body = await request.json() as Record<string, unknown>;
  const id = cleanText(body.id, 80);
  const status = cleanText(body.status, 40);
  const coordinator = cleanText(body.coordinator, 100);
  const programmeDate = cleanText(body.programmeDate, 10);
  const startTime = cleanText(body.startTime, 5);
  if (!id || !CULTURAL_STATUSES.includes(status as never)) return Response.json({ error: "Choose a valid registration status." }, { status: 400 });
  if (status === "scheduled" && (!/^\d{4}-\d{2}-\d{2}$/.test(programmeDate) || !/^\d{2}:\d{2}$/.test(startTime)))
    return Response.json({ error: "Scheduled programmes require a date and start time." }, { status: 400 });
  await ensureDatabase();
  const d1 = getD1();
  const result = await d1.prepare(`UPDATE cultural_programmes SET status=?,coordinator=?,programme_date=?,start_time=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND event_id=?`)
    .bind(status,coordinator,programmeDate,startTime,id,EVENT_ID).run();
  if (!result.meta.changes) return Response.json({ error: "Cultural registration not found." }, { status: 404 });
  await d1.prepare(`INSERT INTO audit_log(id,entity_type,entity_id,action,actor,details)
    VALUES(?,'cultural_programme',?,'status_updated',?,?)`).bind(crypto.randomUUID(),id,auth.user.username,JSON.stringify({status,coordinator,programmeDate,startTime})).run();
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await authorize(request,["admin","cultural"]);
  if ("response" in auth) return auth.response;
  const url = new URL(request.url);
  const id = cleanText(url.searchParams.get("id"), 80);
  if (!id) return Response.json({ error: "Programme id required." }, { status: 400 });
  await ensureDatabase();
  const d1 = getD1();
  if (url.searchParams.get("recycle") === "true") {
    if (!isPortalOwner(auth.user)) return Response.json({ error: "Portal Admin access required." }, { status: 403 });
    const existing = await d1.prepare("SELECT reference_no referenceNo,title,status FROM cultural_programmes WHERE id=? AND event_id=? AND status<>'recycled'")
      .bind(id,EVENT_ID).first<{referenceNo:string;title:string;status:string}>();
    if (!existing) return Response.json({ error: "Cultural registration not found." }, { status: 404 });
    await d1.batch([
      d1.prepare(`INSERT INTO recycle_bin(id,event_id,entity_type,entity_id,entity_label,restore_data,deleted_by)
        VALUES(?,?,'cultural_programme',?,?,?,?)`).bind(crypto.randomUUID(),EVENT_ID,id,`${existing.referenceNo} · ${existing.title}`,JSON.stringify({status:existing.status}),auth.user.username),
      d1.prepare("UPDATE cultural_programmes SET status='recycled',updated_at=CURRENT_TIMESTAMP WHERE id=? AND event_id=?").bind(id,EVENT_ID),
      d1.prepare(`INSERT INTO audit_log(id,entity_type,entity_id,action,actor,details)
        VALUES(?,'cultural_programme',?,'moved_to_recycle_bin',?,'{}')`).bind(crypto.randomUUID(),id,auth.user.username),
    ]);
    return Response.json({ ok: true, recycled: true });
  }
  await d1.batch([
    d1.prepare("UPDATE cultural_programmes SET status='withdrawn',updated_at=CURRENT_TIMESTAMP WHERE id=? AND event_id=?").bind(id,EVENT_ID),
    d1.prepare(`INSERT INTO audit_log(id,entity_type,entity_id,action,actor,details)
      VALUES(?,'cultural_programme',?,'withdrawn',?,'{}')`).bind(crypto.randomUUID(),id,auth.user.username),
  ]);
  return Response.json({ ok: true });
}
