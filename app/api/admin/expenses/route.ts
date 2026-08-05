import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { EVENT_ID } from "../../../lib/constants";
import { adminActor, cleanText, isAdminRequest, wholeNumber } from "../../../lib/server";

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "Administrator access required." }, { status: 401 });
  const body = (await request.json()) as Record<string, unknown>;
  const category = cleanText(body.category, 50);
  const vendor = cleanText(body.vendor, 100);
  const description = cleanText(body.description, 300);
  const amount = wholeNumber(body.amount, 1);
  const expenseDate = cleanText(body.expenseDate, 10);
  const receiptUrl = cleanText(body.receiptUrl, 500);
  if (!category || !vendor || !description || amount === null || !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
    return Response.json({ error: "Complete all required expense fields." }, { status: 400 });
  }
  if (receiptUrl && !/^https:\/\//i.test(receiptUrl)) {
    return Response.json({ error: "Receipt link must use HTTPS." }, { status: 400 });
  }

  await ensureDatabase();
  const d1 = getD1();
  const id = crypto.randomUUID();
  const actor = await adminActor(request);
  await d1.batch([
    d1
      .prepare(
        `INSERT INTO expenses
        (id, event_id, category, vendor, description, amount, expense_date, receipt_url, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)`,
      )
      .bind(id, EVENT_ID, category, vendor, description, amount, expenseDate, receiptUrl, actor),
    d1
      .prepare(
        `INSERT INTO audit_log (id, entity_type, entity_id, action, actor, details)
         VALUES (?, 'expense', ?, 'created', ?, ?)`,
      )
      .bind(crypto.randomUUID(), id, actor, JSON.stringify({ amount, category })),
  ]);
  return Response.json({ id }, { status: 201 });
}
