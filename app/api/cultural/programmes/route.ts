import { env } from "cloudflare:workers";
import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { getAppUser, authorize, isPortalOwner } from "../../../lib/auth";
import { BLOCKS, EVENT_ID } from "../../../lib/constants";
import { CULTURAL_CATEGORIES, CULTURAL_STATUSES } from "../../../lib/cultural";
import { hashSessionToken, newSessionToken } from "../../../lib/passwords";
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
  const url = new URL(request.url);
  const editToken = cleanText(url.searchParams.get("editToken"), 200);
  const requestedId = cleanText(url.searchParams.get("id"), 80);
  await ensureDatabase();
  if (editToken) {
    const programme = await getD1().prepare(`SELECT id,reference_no referenceNo,title,performance_type performanceType,
      category,participant_details participantDetails,contact_name contactName,contact_phone contactPhone,
      duration_minutes durationMinutes,status,background_music backgroundMusic,audio_key IS NOT NULL hasAudio,audio_name audioName,audio_arrangement audioArrangement,device_details deviceDetails,notes
      FROM cultural_programmes WHERE event_id=? AND edit_token_hash=? AND status<>'recycled'`)
      .bind(EVENT_ID,await hashSessionToken(editToken)).first();
    if (!programme) return Response.json({ error: "This edit link is invalid or no longer available." }, { status: 404 });
    return Response.json({ programme, residentEdit: true });
  }
  const auth = await authorize(request,["admin","cultural"]);
  if ("response" in auth) return auth.response;
  if (requestedId) {
    const programme = await getD1().prepare(`SELECT id,reference_no referenceNo,title,performance_type performanceType,
      category,participant_details participantDetails,contact_name contactName,contact_phone contactPhone,
      duration_minutes durationMinutes,status,background_music backgroundMusic,audio_key IS NOT NULL hasAudio,audio_name audioName,audio_arrangement audioArrangement,device_details deviceDetails,notes
      FROM cultural_programmes WHERE id=? AND event_id=? AND status<>'recycled'`).bind(requestedId,EVENT_ID).first();
    if (!programme) return Response.json({ error: "Cultural registration not found." }, { status: 404 });
    return Response.json({ programme, user: { ...auth.user, portalOwner: isPortalOwner(auth.user) } });
  }
  const rows = await getD1().prepare(`SELECT id,reference_no referenceNo,title,performance_type performanceType,
    category,participant_details participantDetails,coordinator,contact_name contactName,contact_phone contactPhone,
    block_no blockNo,flat_no flatNo,programme_date programmeDate,start_time startTime,duration_minutes durationMinutes,
    status,background_music backgroundMusic,audio_key IS NOT NULL hasAudio,audio_name audioName,audio_arrangement audioArrangement,device_details deviceDetails,
    stage_requirements stageRequirements,props_requirements propsRequirements,setup_minutes setupMinutes,
    source,created_by createdBy,created_at createdAt,notes
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
  const category = cleanText(body.get("category"), 80);
  const isKolatam = category === "Kolatam";
  const performanceType = isKolatam ? "group" : cleanText(body.get("performanceType"), 10).toLowerCase();
  const title = isKolatam ? "Kolatam" : cleanText(body.get("title"), 160);
  const participants = parseParticipants(body.get("participantDetails"));
  const contactName = cleanText(body.get("contactName"), 100);
  const contactPhone = cleanText(body.get("contactPhone"), 20).replace(/\D/g, "");
  const durationMinutes = isKolatam ? 0 : wholeNumber(body.get("durationMinutes"), 1, 30);
  const audioArrangement = isKolatam ? "not_required" : cleanText(body.get("audioArrangement"), 30);
  const deviceDetails = isKolatam ? "" : cleanText(body.get("deviceDetails"), 500);
  const stageRequirements = cleanText(body.get("stageRequirements"), 1000);
  const propsRequirements = cleanText(body.get("propsRequirements"), 1000);
  const setupMinutes = 0;
  const notes = cleanText(body.get("notes"), 600);
  const audio = body.get("audioTrack");

  if (!["solo", "group"].includes(performanceType)) return Response.json({ error: "Choose Solo or Group." }, { status: 400 });
  if (!CULTURAL_CATEGORIES.includes(category as never)) return Response.json({ error: "Choose a valid performance category." }, { status: 400 });
  if (!title) return Response.json({ error: "Enter the performance title." }, { status: 400 });
  if (!participants) return Response.json({ error: "Enter a valid name, age, block and flat number for every participant." }, { status: 400 });
  if (isKolatam && participants.length !== 1) return Response.json({ error: "A Kolatam entry must contain one representative." }, { status: 400 });
  if (performanceType === "solo" && participants.length !== 1) return Response.json({ error: "A solo entry must contain one participant." }, { status: 400 });
  if (!isKolatam && performanceType === "group" && participants.length < 2) return Response.json({ error: "Add at least two participants for a group entry." }, { status: 400 });
  if (!isKolatam && performanceType === "group" && !notes) return Response.json({ error: "Enter the expected participant total in Group Notes." }, { status: 400 });
  if (!contactName || !/^\d{10}$/.test(contactPhone)) return Response.json({ error: "Enter the point of contact name and a valid 10-digit mobile number." }, { status: 400 });
  if (durationMinutes === null) return Response.json({ error: "Enter a valid duration." }, { status: 400 });
  if (!isKolatam && !["upload", "own_device"].includes(audioArrangement)) return Response.json({ error: "Choose how the performance audio will be provided." }, { status: 400 });
  if (audioArrangement === "own_device" && !deviceDetails) return Response.json({ error: "Enter the performer’s device and connection details." }, { status: 400 });
  const hasAudio = !isKolatam && audio instanceof File && audio.size > 0;
  if (audioArrangement === "upload" && !hasAudio) return Response.json({ error: "Upload the song file." }, { status: 400 });
  if (hasAudio && (!AUDIO_TYPES.has(audio.type) || audio.size > MAX_AUDIO_BYTES))
    return Response.json({ error: "Upload an MP3, M4A or WAV audio track up to 8 MB." }, { status: 400 });

  await ensureDatabase();
  const d1 = getD1();
  const id = crypto.randomUUID();
  const referenceNo = `CP26-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
  const actor = user?.username ?? "resident-self-service";
  const source = user ? "volunteer" : "resident";
  const editToken = user ? null : newSessionToken();
  const editTokenHash = editToken ? await hashSessionToken(editToken) : null;
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
         audio_key,audio_name,audio_type,audio_arrangement,device_details,stage_requirements,props_requirements,setup_minutes,source,edit_token_hash,created_by,notes)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'submitted',?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id,EVENT_ID,referenceNo,title,performanceType,category,JSON.stringify(participants),"",
          contactName,contactPhone,first.blockNo,first.flatNo,durationMinutes,isKolatam ? 0 : 1,
          audioKey,hasAudio ? audio.name : null,hasAudio ? audio.type : null,audioArrangement,deviceDetails,stageRequirements,propsRequirements,
          setupMinutes,source,editTokenHash,actor,notes),
      d1.prepare(`INSERT INTO audit_log(id,entity_type,entity_id,action,actor,details)
        VALUES(?,'cultural_programme',?,'submitted',?,?)`)
        .bind(crypto.randomUUID(),id,actor,JSON.stringify({referenceNo,source,performanceType,category,participantCount:participants.length})),
    ]);
    return Response.json({ referenceNo, editToken }, { status: 201 });
  } catch (error) {
    if (audioKey) await proofStore?.delete(audioKey);
    throw error;
  }
}

export async function PUT(request: Request) {
  const body = await request.formData();
  const editToken = cleanText(body.get("editToken"), 200);
  const requestedId = cleanText(body.get("id"), 80);
  await ensureDatabase();
  const d1 = getD1();
  type EditableProgramme={id:string;referenceNo:string;status:string;audioKey:string|null;audioName:string|null;audioType:string|null};
  let existing:EditableProgramme|null=null;
  let actor="resident-self-edit";
  let residentEdit=false;
  if (editToken) {
    existing=await d1.prepare("SELECT id,reference_no referenceNo,status,audio_key audioKey,audio_name audioName,audio_type audioType FROM cultural_programmes WHERE event_id=? AND edit_token_hash=? AND status<>'recycled'").bind(EVENT_ID,await hashSessionToken(editToken)).first<EditableProgramme>();
    residentEdit=true;
  } else {
    const auth=await authorize(request,["admin","cultural"]);if("response" in auth)return auth.response;
    actor=auth.user.username;
    existing=await d1.prepare("SELECT id,reference_no referenceNo,status,audio_key audioKey,audio_name audioName,audio_type audioType FROM cultural_programmes WHERE id=? AND event_id=? AND status<>'recycled'").bind(requestedId,EVENT_ID).first<EditableProgramme>();
  }
  if (!existing) return Response.json({ error: "Cultural registration not found or the edit link is invalid." }, { status: 404 });
  const category=cleanText(body.get("category"),80);
  const isKolatam=category==="Kolatam";
  const performanceType=isKolatam?"group":cleanText(body.get("performanceType"),10).toLowerCase();
  const title=isKolatam?"Kolatam":cleanText(body.get("title"),160);
  const participantDetails=parseParticipants(body.get("participantDetails"));
  const contactName=cleanText(body.get("contactName"),100);
  const contactPhone=cleanText(body.get("contactPhone"),20).replace(/\D/g,"");
  const durationMinutes=isKolatam?0:wholeNumber(body.get("durationMinutes"),1,30);
  const audioArrangement=isKolatam?"not_required":cleanText(body.get("audioArrangement"),30);
  const deviceDetails=isKolatam?"":cleanText(body.get("deviceDetails"),500);
  const notes=cleanText(body.get("notes"),600);
  const audio=body.get("audioTrack");
  if(!["solo","group"].includes(performanceType))return Response.json({error:"Choose Solo or Group."},{status:400});
  if(!CULTURAL_CATEGORIES.includes(category as never))return Response.json({error:"Choose a valid performance category."},{status:400});
  if(!title)return Response.json({error:"Enter the performance title."},{status:400});
  if(!participantDetails)return Response.json({error:"Enter a valid name, age, block and flat number for every participant."},{status:400});
  if(isKolatam&&participantDetails.length!==1)return Response.json({error:"A Kolatam entry must contain one representative."},{status:400});
  if(performanceType==="solo"&&participantDetails.length!==1)return Response.json({error:"A solo entry must contain one participant."},{status:400});
  if(!isKolatam&&performanceType==="group"&&participantDetails.length<2)return Response.json({error:"Add at least two participants for a group entry."},{status:400});
  if(!isKolatam&&performanceType==="group"&&!notes)return Response.json({error:"Enter the expected participant total in Group Notes."},{status:400});
  if(!contactName||!/^\d{10}$/.test(contactPhone))return Response.json({error:"Enter the point of contact name and a valid 10-digit mobile number."},{status:400});
  if(durationMinutes===null)return Response.json({error:"Enter a valid duration."},{status:400});
  if(!isKolatam&&!["upload","own_device"].includes(audioArrangement))return Response.json({error:"Choose how the performance audio will be provided."},{status:400});
  if(audioArrangement==="own_device"&&!deviceDetails)return Response.json({error:"Enter the performer’s device and connection details."},{status:400});
  const hasNewAudio=!isKolatam&&audio instanceof File&&audio.size>0;
  if(audioArrangement==="upload"&&!hasNewAudio&&!existing.audioKey)return Response.json({error:"Upload the song file."},{status:400});
  if(hasNewAudio&&(!AUDIO_TYPES.has(audio.type)||audio.size>MAX_AUDIO_BYTES))return Response.json({error:"Upload an MP3, M4A or WAV audio track up to 8 MB."},{status:400});
  const proofStore=(env as unknown as{PAYMENT_PROOFS?:KVNamespace}).PAYMENT_PROOFS;
  let newAudioKey:string|null=null;
  if(hasNewAudio){if(!proofStore)return Response.json({error:"Audio storage is temporarily unavailable."},{status:503});newAudioKey=`${EVENT_ID}/cultural/${existing.id}/${crypto.randomUUID()}`;await proofStore.put(newAudioKey,await audio.arrayBuffer(),{metadata:{originalName:audio.name,contentType:audio.type,uploadedBy:actor}});}
  const first=participantDetails[0];
  const nextStatus=residentEdit?"submitted":existing.status;
  const finalAudioKey=!isKolatam&&audioArrangement==="upload"?(newAudioKey??existing.audioKey):null;
  const finalAudioName=!isKolatam&&audioArrangement==="upload"?(hasNewAudio?audio.name:existing.audioName):null;
  const finalAudioType=!isKolatam&&audioArrangement==="upload"?(hasNewAudio?audio.type:existing.audioType):null;
  try{
    await d1.batch([
      d1.prepare(`UPDATE cultural_programmes SET title=?,performance_type=?,category=?,participant_details=?,contact_name=?,contact_phone=?,block_no=?,flat_no=?,duration_minutes=?,background_music=?,audio_key=?,audio_name=?,audio_type=?,audio_arrangement=?,device_details=?,notes=?,status=?,programme_date=CASE WHEN ? THEN '' ELSE programme_date END,start_time=CASE WHEN ? THEN '' ELSE start_time END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND event_id=?`).bind(title,performanceType,category,JSON.stringify(participantDetails),contactName,contactPhone,first.blockNo,first.flatNo,durationMinutes,isKolatam?0:1,finalAudioKey,finalAudioName,finalAudioType,audioArrangement,deviceDetails,notes,nextStatus,residentEdit?1:0,residentEdit?1:0,existing.id,EVENT_ID),
      d1.prepare(`INSERT INTO audit_log(id,entity_type,entity_id,action,actor,details) VALUES(?,'cultural_programme',?,'entry_updated',?,?)`).bind(crypto.randomUUID(),existing.id,actor,JSON.stringify({residentEdit,referenceNo:existing.referenceNo})),
    ]);
    if(existing.audioKey&&(newAudioKey||audioArrangement==="own_device"||isKolatam))await proofStore?.delete(existing.audioKey).catch(()=>undefined);
    return Response.json({ok:true,referenceNo:existing.referenceNo,editToken:editToken||null});
  }catch(error){if(newAudioKey)await proofStore?.delete(newAudioKey).catch(()=>undefined);throw error;}
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
