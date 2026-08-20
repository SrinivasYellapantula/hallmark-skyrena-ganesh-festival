import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { EVENT_ID } from "../../../lib/constants";
import { getAppUser, isPortalOwner } from "../../../lib/auth";

export async function GET(request: Request) {
  const user = await getAppUser(request);
  if (user?.role !== "admin") return Response.json({ error: "Administrator access required." }, { status: 401 });
  await ensureDatabase();
  const d1 = getD1();
  const url = new URL(request.url);
  const requestedStatus = url.searchParams.get("status") ?? "all";
  const status = ["all", "submitted", "verified", "correction_requested"].includes(requestedStatus) ? requestedStatus : "all";
  const requestedPage = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = 50;
  const statusClause = status === "all" ? "" : " AND r.status = ?";
  const statusBindings = status === "all" ? [EVENT_ID] : [EVENT_ID, status];

  const [countRow, totals] = await Promise.all([
    d1.prepare(`SELECT COUNT(*) total FROM registrations r
      WHERE r.event_id = ? AND r.status != 'cancelled'${statusClause}`).bind(...statusBindings).first<{ total: number }>(),
    d1
      .prepare(
        `SELECT
          COALESCE(SUM(CASE WHEN d.status = 'verified' THEN d.amount ELSE 0 END), 0) verified,
          COALESCE(SUM(CASE WHEN d.status = 'pending' THEN d.amount ELSE 0 END), 0) pending,
          COUNT(DISTINCT r.id) submissions,
          COUNT(DISTINCT CASE WHEN r.status = 'submitted' THEN r.id END) submittedCount,
          COUNT(DISTINCT CASE WHEN r.status = 'verified' THEN r.id END) verifiedCount,
          COUNT(DISTINCT CASE WHEN r.status = 'correction_requested' THEN r.id END) correctionCount
         FROM registrations r LEFT JOIN donations d ON d.registration_id = r.id
         WHERE r.event_id = ? AND r.status != 'cancelled'`,
      )
      .bind(EVENT_ID)
      .first(),
  ]);
  const total = Number(countRow?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * pageSize;
  const registrations = await d1
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
         WHERE r.event_id = ? AND r.status != 'cancelled'${statusClause}
         GROUP BY r.id ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
      )
      .bind(...statusBindings, pageSize, offset)
      .all();
  return Response.json({
    registrations: registrations.results,
    totals,
    statusCounts: {
      all: Number(totals?.submissions ?? 0),
      submitted: Number(totals?.submittedCount ?? 0),
      verified: Number(totals?.verifiedCount ?? 0),
      correction_requested: Number(totals?.correctionCount ?? 0),
    },
    pagination: { page, pageSize, total, totalPages },
    portalOwner: isPortalOwner(user),
  });
}
