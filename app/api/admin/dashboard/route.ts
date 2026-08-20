import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { EVENT_ID } from "../../../lib/constants";
import { getAppUser, isPortalOwner } from "../../../lib/auth";

export async function GET(request: Request) {
  const user = await getAppUser(request);
  if (user?.role !== "admin") return Response.json({ error: "Administrator access required." }, { status: 401 });
  await ensureDatabase();
  const d1 = getD1();
  const [registrations, totals] = await Promise.all([
    d1
      .prepare(
        `SELECT r.id, r.reference_no referenceNo, r.resident_name residentName,
          r.block_no blockNo, r.flat_no flatNo, r.adult_count adultCount,
          r.child_count childCount, r.status, r.created_at createdAt,
          COALESCE(SUM(d.amount), 0) amount,
          MIN(d.status) paymentStatus, MAX(d.payment_method) paymentMethod,
          MAX(d.payment_reference) paymentReference,
          MAX(CASE WHEN d.payment_proof_key IS NOT NULL THEN 1 ELSE 0 END) hasProof,
          COALESCE((SELECT json_extract(a.details, '$.reason') FROM audit_log a
            WHERE a.entity_type='registration' AND a.entity_id=r.id AND a.action='correction_requested'
            ORDER BY a.created_at DESC LIMIT 1), '') correctionReason
         FROM registrations r LEFT JOIN donations d ON d.registration_id = r.id
         WHERE r.event_id = ? AND r.status != 'cancelled'
         GROUP BY r.id ORDER BY r.created_at DESC LIMIT 100`,
      )
      .bind(EVENT_ID)
      .all(),
    d1
      .prepare(
        `SELECT
          COALESCE(SUM(CASE WHEN d.status = 'verified' THEN d.amount ELSE 0 END), 0) verified,
          COALESCE(SUM(CASE WHEN d.status = 'pending' THEN d.amount ELSE 0 END), 0) pending,
          COUNT(DISTINCT r.id) submissions
         FROM registrations r LEFT JOIN donations d ON d.registration_id = r.id
         WHERE r.event_id = ? AND r.status != 'cancelled'`,
      )
      .bind(EVENT_ID)
      .first(),
  ]);
  return Response.json({ registrations: registrations.results, totals, portalOwner: isPortalOwner(user) });
}
