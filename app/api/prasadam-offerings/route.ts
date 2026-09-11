import { getD1 } from "../../../db";
import { ensureDatabase } from "../../../db/initialize";
import { authorize, getAppUser, scopedBlock } from "../../lib/auth";
import { BLOCKS, EVENT_ID } from "../../lib/constants";
import { eligiblePrasadamDays, isPrasadamDateAllowed } from "../../lib/prasadam";
import { cleanText, isValidFlatNo, normalizeFlatNo, wholeNumber } from "../../lib/server";

const STATUSES = ["submitted", "confirmed", "cancelled"] as const;

export async function POST(request: Request) {
  const body = await request.json() as Record<string, unknown>;
  const blockNo = cleanText(body.blockNo, 2).toUpperCase();
  const flatNo = normalizeFlatNo(body.flatNo, blockNo);
  const residentName = cleanText(body.residentName, 100);
  const phone = cleanText(body.phone, 20).replace(/\D/g, "");
  const offeringDate = cleanText(body.offeringDate, 10);
  const prasadamName = cleanText(body.prasadamName, 160);
  const portions = wholeNumber(body.portions, 1, 2000);
  const notes = cleanText(body.notes, 500);
  if (!BLOCKS.includes(blockNo as never)) return Response.json({ error: "Choose your block." }, { status: 400 });
  if (!isValidFlatNo(flatNo, blockNo)) return Response.json({ error: `Enter a valid Block ${blockNo} flat number. You may include the selected block letter.` }, { status: 400 });
  if (!residentName) return Response.json({ error: "Enter your name." }, { status: 400 });
  if (!/^\d{10}$/.test(phone)) return Response.json({ error: "Enter a valid 10-digit mobile number." }, { status: 400 });
  if (!isPrasadamDateAllowed(blockNo, offeringDate)) return Response.json({ error: `Choose the assigned Block ${blockNo} day or the open-offering day.` }, { status: 400 });
  if (!prasadamName) return Response.json({ error: "Enter the prasadam you wish to offer." }, { status: 400 });
  if (portions === null) return Response.json({ error: "Enter a valid number of portions between 1 and 2,000." }, { status: 400 });
  const selectedDay = eligiblePrasadamDays(blockNo).find((item) => item.date === offeringDate)!;
  const user = await getAppUser(request);
  await ensureDatabase();
  const id = crypto.randomUUID();
  const referenceNo = `PS26-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
  const actor = user?.username ?? "resident-self-service";
  await getD1().batch([
    getD1().prepare(`INSERT INTO prasadam_offerings
      (id,event_id,reference_no,block_no,flat_no,resident_name,phone,offering_date,day_number,prasadam_name,portions,notes,status,created_by)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'submitted',?)`)
      .bind(id,EVENT_ID,referenceNo,blockNo,flatNo,residentName,phone,offeringDate,selectedDay.day,prasadamName,portions,notes,actor),
    getD1().prepare(`INSERT INTO audit_log(id,entity_type,entity_id,action,actor,details)
      VALUES(?,'prasadam_offering',?,'submitted',?,?)`)
      .bind(crypto.randomUUID(),id,actor,JSON.stringify({referenceNo,blockNo,flatNo,offeringDate,portions})),
  ]);
  return Response.json({ ok: true, referenceNo, dayNumber: selectedDay.day, offeringDate }, { status: 201 });
}

export async function GET(request: Request) {
  const auth = await authorize(request, ["admin", "block", "cultural"]);
  if ("response" in auth) return auth.response;
  const url = new URL(request.url);
  const blockNo = scopedBlock(auth.user, cleanText(url.searchParams.get("block"), 2));
  const offeringDate = cleanText(url.searchParams.get("date"), 10);
  const status = cleanText(url.searchParams.get("status"), 20);
  if (blockNo && !BLOCKS.includes(blockNo as never)) return Response.json({ error: "Invalid block filter." }, { status: 400 });
  if (status && !STATUSES.includes(status as never)) return Response.json({ error: "Invalid status filter." }, { status: 400 });
  await ensureDatabase();
  const rows = await getD1().prepare(`SELECT id,reference_no referenceNo,block_no blockNo,flat_no flatNo,
    resident_name residentName,phone,offering_date offeringDate,day_number dayNumber,prasadam_name prasadamName,
    portions,notes,status,created_at createdAt,updated_at updatedAt
    FROM prasadam_offerings
    WHERE event_id=? AND (?='' OR block_no=?) AND (?='' OR offering_date=?) AND (?='' OR status=?)
    ORDER BY offering_date,block_no,CAST(REPLACE(flat_no,'G','0') AS INTEGER),created_at`)
    .bind(EVENT_ID,blockNo,blockNo,offeringDate,offeringDate,status,status).all();
  return Response.json({ offerings: rows.results, user: auth.user });
}

export async function PATCH(request: Request) {
  const auth = await authorize(request, ["admin", "block", "cultural"]);
  if ("response" in auth) return auth.response;
  const body = await request.json() as Record<string, unknown>;
  const id = cleanText(body.id, 80);
  if (body.action === "edit") {
    if (auth.user.role !== "admin") return Response.json({ error: "Only administrators can edit offering details." }, { status: 403 });
    const blockNo = cleanText(body.blockNo, 2).toUpperCase(); const flatNo = normalizeFlatNo(body.flatNo, blockNo);
    const residentName = cleanText(body.residentName, 100); const phone = cleanText(body.phone, 20).replace(/\D/g, "");
    const offeringDate = cleanText(body.offeringDate, 10); const prasadamName = cleanText(body.prasadamName, 160);
    const portions = wholeNumber(body.portions, 1, 2000); const notes = cleanText(body.notes, 500);
    if (!id) return Response.json({ error: "Choose an offering to edit." }, { status: 400 });
    if (!BLOCKS.includes(blockNo as never)) return Response.json({ error: "Choose the resident block." }, { status: 400 });
    if (!isValidFlatNo(flatNo, blockNo)) return Response.json({ error: `Enter a valid Block ${blockNo} flat number.` }, { status: 400 });
    if (!residentName) return Response.json({ error: "Enter the resident name." }, { status: 400 });
    if (!/^\d{10}$/.test(phone)) return Response.json({ error: "Enter a valid 10-digit mobile number." }, { status: 400 });
    if (!isPrasadamDateAllowed(blockNo, offeringDate)) return Response.json({ error: `Choose the assigned Block ${blockNo} day or the open-offering day.` }, { status: 400 });
    if (!prasadamName) return Response.json({ error: "Enter the prasadam being offered." }, { status: 400 });
    if (portions === null) return Response.json({ error: "Enter portions between 1 and 2,000." }, { status: 400 });
    const selectedDay = eligiblePrasadamDays(blockNo).find((item) => item.date === offeringDate)!;
    await ensureDatabase();
    const existing = await getD1().prepare("SELECT id FROM prasadam_offerings WHERE id=? AND event_id=?").bind(id, EVENT_ID).first();
    if (!existing) return Response.json({ error: "Offering not found." }, { status: 404 });
    const details = { blockNo, flatNo, residentName, phone, offeringDate, dayNumber: selectedDay.day, prasadamName, portions, notes };
    await getD1().batch([
      getD1().prepare(`UPDATE prasadam_offerings SET block_no=?,flat_no=?,resident_name=?,phone=?,offering_date=?,day_number=?,prasadam_name=?,portions=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND event_id=?`)
        .bind(blockNo,flatNo,residentName,phone,offeringDate,selectedDay.day,prasadamName,portions,notes,id,EVENT_ID),
      getD1().prepare(`INSERT INTO audit_log(id,entity_type,entity_id,action,actor,details) VALUES(?,'prasadam_offering',?,'details_corrected',?,?)`)
        .bind(crypto.randomUUID(),id,auth.user.username,JSON.stringify(details)),
    ]);
    return Response.json({ ok: true });
  }
  const status = cleanText(body.status, 20);
  if (!id || !STATUSES.includes(status as never)) return Response.json({ error: "Choose a valid offering and status." }, { status: 400 });
  await ensureDatabase();
  const row = await getD1().prepare("SELECT block_no blockNo FROM prasadam_offerings WHERE id=? AND event_id=?").bind(id,EVENT_ID).first<{blockNo:string}>();
  if (!row || (auth.user.role === "block" && row.blockNo !== auth.user.blockNo)) return Response.json({ error: "Offering not found." }, { status: 404 });
  await getD1().batch([
    getD1().prepare("UPDATE prasadam_offerings SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND event_id=?").bind(status,id,EVENT_ID),
    getD1().prepare(`INSERT INTO audit_log(id,entity_type,entity_id,action,actor,details) VALUES(?,'prasadam_offering',?,'status_updated',?,?)`).bind(crypto.randomUUID(),id,auth.user.username,JSON.stringify({status})),
  ]);
  return Response.json({ ok: true });
}
