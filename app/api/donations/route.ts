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
    SUM(CASE WHEN d.category = 'idol' THEN d.amount ELSE 0 END) idolAmount,
    SUM(CASE WHEN d.category = 'annadaanam' THEN d.amount ELSE 0 END) annadaanamAmount,
    MAX(d.payment_reference) paymentReference,
    MAX(CASE WHEN d.payment_proof_key IS NOT NULL THEN 1 ELSE 0 END) hasProof,
    CASE WHEN EXISTS (
      SELECT 1 FROM flats f WHERE f.event_id=r.event_id AND f.occupied=1
        AND UPPER(TRIM(f.block_no))=UPPER(TRIM(r.block_no))
        AND CASE
          WHEN SUBSTR(REPLACE(REPLACE(UPPER(TRIM(f.flat_no)),'-',''),' ',''),1,1)=UPPER(TRIM(f.block_no))
            AND SUBSTR(REPLACE(REPLACE(UPPER(TRIM(f.flat_no)),'-',''),' ',''),2,1) BETWEEN '0' AND '9'
          THEN SUBSTR(REPLACE(REPLACE(UPPER(TRIM(f.flat_no)),'-',''),' ',''),2)
          ELSE REPLACE(REPLACE(UPPER(TRIM(f.flat_no)),'-',''),' ','') END
        = CASE
          WHEN SUBSTR(REPLACE(REPLACE(UPPER(TRIM(r.flat_no)),'-',''),' ',''),1,1)=UPPER(TRIM(r.block_no))
            AND SUBSTR(REPLACE(REPLACE(UPPER(TRIM(r.flat_no)),'-',''),' ',''),2,1) BETWEEN '0' AND '9'
          THEN SUBSTR(REPLACE(REPLACE(UPPER(TRIM(r.flat_no)),'-',''),' ',''),2)
          ELSE REPLACE(REPLACE(UPPER(TRIM(r.flat_no)),'-',''),' ','') END
    ) THEN 1 ELSE 0 END inOccupiedMaster,
    COALESCE((SELECT json_extract(a.details, '$.reason') FROM audit_log a
      WHERE a.entity_type='registration' AND a.entity_id=r.id AND a.action='correction_requested'
      ORDER BY a.created_at DESC LIMIT 1), '') correctionReason
    FROM registrations r JOIN donations d ON d.registration_id=r.id
    WHERE r.event_id=? AND r.status!='cancelled' ${blockClause}
    GROUP BY r.id ORDER BY r.created_at DESC LIMIT 300`);
  const rows=auth.user.role === "block" ? await statement.bind(EVENT_ID,auth.user.blockNo).all() : await statement.bind(EVENT_ID).all();
  return Response.json({donations:rows.results,user:auth.user});
}
