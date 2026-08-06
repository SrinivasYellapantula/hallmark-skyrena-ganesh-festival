import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { authorize, scopedBlock } from "../../../lib/auth";
import { BLOCKS, EVENT_ID } from "../../../lib/constants";

export async function GET(request: Request) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  let block = scopedBlock(auth.user, new URL(request.url).searchParams.get("block"));
  if (auth.user.role === "admin" && !BLOCKS.includes(block as (typeof BLOCKS)[number])) block = BLOCKS[0];
  if (!BLOCKS.includes(block as (typeof BLOCKS)[number])) return Response.json({ flats: [], block, user: auth.user });
  await ensureDatabase();
  const rows = await getD1().prepare(
    `SELECT f.id,f.block_no blockNo,f.flat_no flatNo,
      CASE WHEN COALESCE(d.donated,0)=1 AND d.donorName<>'' THEN d.donorName ELSE f.resident_name END residentName,
      f.visit_status visitStatus,f.visit_notes visitNotes,COALESCE(d.donated,0) donated,
      COALESCE(d.donationAmount,0) donationAmount,d.referenceNo
     FROM flats f
     LEFT JOIN (
       SELECT r.block_no blockNo,r.flat_no flatNo,MAX(r.resident_name) donorName,
         MAX(r.reference_no) referenceNo,
         MAX(CASE WHEN r.status!='cancelled' AND dn.status!='reversed' THEN 1 ELSE 0 END) donated,
         SUM(CASE WHEN r.status!='cancelled' AND dn.status!='reversed' THEN dn.amount ELSE 0 END) donationAmount
       FROM registrations r LEFT JOIN donations dn ON dn.registration_id=r.id
       WHERE r.event_id=? GROUP BY r.block_no,r.flat_no
     ) d ON d.blockNo=f.block_no AND d.flatNo=f.flat_no
     WHERE f.event_id=? AND f.block_no=? AND f.occupied=1
     ORDER BY CAST(f.flat_no AS INTEGER),f.flat_no`,
  ).bind(EVENT_ID, EVENT_ID, block).all();
  return Response.json({ flats: rows.results, block, user: auth.user });
}
