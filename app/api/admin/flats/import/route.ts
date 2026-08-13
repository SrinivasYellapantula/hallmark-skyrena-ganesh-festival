import { getD1 } from "../../../../../db";
import { ensureDatabase } from "../../../../../db/initialize";
import { authorize } from "../../../../lib/auth";
import { BLOCKS, EVENT_ID } from "../../../../lib/constants";
import { cleanText, normalizeFlatNo } from "../../../../lib/server";

type FlatInput = { flatNo?: unknown; residentName?: unknown; occupancy?: unknown };

export async function POST(request: Request) {
  const auth = await authorize(request, ["admin"]);
  if ("response" in auth) return auth.response;
  const body = await request.json() as { blockNo?: unknown; flats?: unknown };
  const blockNo = cleanText(body.blockNo, 2).toUpperCase();
  if (!BLOCKS.includes(blockNo as (typeof BLOCKS)[number])) return Response.json({ error: "Choose block A, B, C, D or E." }, { status: 400 });
  if (!Array.isArray(body.flats) || body.flats.length === 0 || body.flats.length > 1000) return Response.json({ error: "Upload a CSV containing between 1 and 1,000 occupied flats." }, { status: 400 });
  const seen = new Set<string>();
  const flats = body.flats.map((raw) => {
    const item = raw as FlatInput; const flatNo = normalizeFlatNo(item.flatNo, blockNo);
    const requestedOccupancy = cleanText(item.occupancy, 10).toLowerCase();
    return { flatNo, residentName: cleanText(item.residentName, 100), occupancy: ["owner", "tenant"].includes(requestedOccupancy) ? requestedOccupancy : "" };
  }).filter((item) => item.flatNo && !seen.has(item.flatNo) && Boolean(seen.add(item.flatNo)));
  if (!flats.length) return Response.json({ error: "No valid flat numbers were found in the CSV." }, { status: 400 });

  await ensureDatabase(); const d1 = getD1();
  await d1.prepare("UPDATE flats SET occupied=0,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE event_id=? AND block_no=?").bind(auth.user.username,EVENT_ID,blockNo).run();
  const statements = flats.map((flat) => d1.prepare(
    `INSERT INTO flats(id,event_id,block_no,flat_no,resident_name,occupancy,occupied,visit_status,updated_by)
     VALUES(?,?,?,?,?,?,1,'pending',?)
     ON CONFLICT(event_id,block_no,flat_no) DO UPDATE SET occupied=1,
       resident_name=CASE WHEN excluded.resident_name<>'' THEN excluded.resident_name ELSE flats.resident_name END,
       occupancy=CASE WHEN excluded.occupancy<>'' THEN excluded.occupancy ELSE flats.occupancy END,
       updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`,
  ).bind(crypto.randomUUID(),EVENT_ID,blockNo,flat.flatNo,flat.residentName,flat.occupancy,auth.user.username));
  for (let index=0; index<statements.length; index+=50) await d1.batch(statements.slice(index,index+50));
  await d1.prepare(`INSERT INTO audit_log(id,entity_type,entity_id,action,actor,details) VALUES(?,'occupied_flats',?,'csv_imported',?,?)`).bind(crypto.randomUUID(),`${EVENT_ID}:${blockNo}`,auth.user.username,JSON.stringify({ blockNo, count: flats.length })).run();
  return Response.json({ ok: true, blockNo, imported: flats.length });
}
