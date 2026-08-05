import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { EVENT_ID } from "../../../lib/constants";
import { authorize } from "../../../lib/auth";

export async function GET(request: Request) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  try {
    await ensureDatabase();
    const d1 = getD1();
    const [totals, blocks, donors, expenses] = await Promise.all([
      d1
        .prepare(
          `WITH verified_donations AS (
             SELECT registration_id,
               SUM(CASE WHEN category = 'festival' THEN amount ELSE 0 END) festival,
               SUM(CASE WHEN category = 'annadaanam' THEN amount ELSE 0 END) annadaanam
             FROM donations WHERE status = 'verified' GROUP BY registration_id
           )
           SELECT COALESCE(SUM(d.festival), 0) festival,
             COALESCE(SUM(d.annadaanam), 0) annadaanam,
             COUNT(r.id) households,
             COALESCE(SUM(r.adult_count), 0) adults,
             COALESCE(SUM(r.child_count), 0) children
           FROM registrations r JOIN verified_donations d ON d.registration_id = r.id
           WHERE r.event_id = ? AND r.status = 'verified'`,
        )
        .bind(EVENT_ID)
        .first(),
      d1
        .prepare(
          `SELECT r.block_no block,
            COALESCE(SUM(d.amount), 0) amount,
            COUNT(DISTINCT r.id) households
           FROM registrations r
           JOIN donations d ON d.registration_id = r.id AND d.status = 'verified'
           WHERE r.event_id = ? AND r.status = 'verified'
           GROUP BY r.block_no ORDER BY r.block_no`,
        )
        .bind(EVENT_ID)
        .all(),
      d1
        .prepare(
          `SELECT r.resident_name name, r.block_no block,
            SUM(d.amount) amount, MAX(d.verified_at) verifiedAt
           FROM registrations r
           JOIN donations d ON d.registration_id = r.id AND d.status = 'verified'
           WHERE r.event_id = ? AND r.status = 'verified' AND r.public_name_consent = 1
           GROUP BY r.id ORDER BY verifiedAt DESC LIMIT 12`,
        )
        .bind(EVENT_ID)
        .all(),
      d1
        .prepare(
          `SELECT category, vendor, description, amount, expense_date expenseDate,
            receipt_url receiptUrl
           FROM expenses
           WHERE event_id = ? AND status = 'approved'
           ORDER BY expense_date DESC, created_at DESC LIMIT 50`,
        )
        .bind(EVENT_ID)
        .all(),
    ]);

    const expenseTotal = expenses.results.reduce(
      (sum, item) => sum + Number((item as Record<string, unknown>).amount ?? 0),
      0,
    );
    return Response.json({ totals: { ...totals, expenses: expenseTotal }, blocks: blocks.results, donors: donors.results, expenses: expenses.results });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load the public summary." },
      { status: 500 },
    );
  }
}
