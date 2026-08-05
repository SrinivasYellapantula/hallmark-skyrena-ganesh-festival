import { getD1 } from "../../../db";
import { ensureDatabase } from "../../../db/initialize";
import { authorize } from "../../lib/auth";
import { EVENT_ID } from "../../lib/constants";

export async function GET(request: Request) {
  const auth = await authorize(request); if ("response" in auth) return auth.response;
  await ensureDatabase(); const d1=getD1(); const blockClause=auth.user.role === "block" ? "AND r.block_no = ?" : "";
  const statement=d1.prepare(`SELECT r.id, r.reference_no referenceNo, r.resident_name residentName,
    r.block_no blockNo, r.flat_no flatNo, r.gotram, r.occupancy, r.phone, r.adult_count adultCount,
    r.child_count childCount, r.notes, r.status, r.created_at createdAt,
    SUM(d.amount) amount,
    SUM(CASE WHEN d.category = 'festival' THEN d.amount ELSE 0 END) festivalAmount,
    SUM(CASE WHEN d.category = 'annadaanam' THEN d.amount ELSE 0 END) annadaanamAmount,
    MAX(d.payment_reference) paymentReference,
    MAX(CASE WHEN d.payment_proof_key IS NOT NULL THEN 1 ELSE 0 END) hasProof
    FROM registrations r JOIN donations d ON d.registration_id=r.id
    WHERE r.event_id=? AND r.status!='cancelled' ${blockClause}
    GROUP BY r.id ORDER BY r.created_at DESC LIMIT 300`);
  const rows=auth.user.role === "block" ? await statement.bind(EVENT_ID,auth.user.blockNo).all() : await statement.bind(EVENT_ID).all();
  return Response.json({donations:rows.results,user:auth.user});
}
