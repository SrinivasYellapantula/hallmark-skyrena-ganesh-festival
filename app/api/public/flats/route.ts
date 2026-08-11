import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { BLOCKS, EVENT_ID } from "../../../lib/constants";

export async function GET(request: Request) {
  const block = (new URL(request.url).searchParams.get("block") ?? "").trim().toUpperCase();
  if (!BLOCKS.includes(block as (typeof BLOCKS)[number])) return Response.json({ flats: [] });

  await ensureDatabase();
  const rows = await getD1().prepare(
    `SELECT flat_no flatNo
     FROM flats
     WHERE event_id=? AND block_no=? AND occupied=1
     ORDER BY CASE WHEN UPPER(flat_no) LIKE 'G%' THEN 0 ELSE 1 END,
       CAST(REPLACE(UPPER(flat_no),'G','') AS INTEGER), flat_no`,
  ).bind(EVENT_ID, block).all();

  return Response.json({ flats: rows.results, block });
}
