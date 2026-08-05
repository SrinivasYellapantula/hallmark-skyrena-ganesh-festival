import { env } from "cloudflare:workers";
import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { EVENT_ID } from "../../../lib/constants";
import { EXPENSE_CATEGORIES } from "../../../lib/expense-categories";
import { adminActor, cleanText, isAdminRequest, wholeNumber } from "../../../lib/server";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_RECEIPT_BYTES = 1024 * 1024;

export async function GET(request: Request) {
  if (!(await isAdminRequest(request)))
    return Response.json({ error: "Administrator access required." }, { status: 401 });
  await ensureDatabase();
  const rows = await getD1().prepare(
    `SELECT id, category, vendor, description, amount, expense_date expenseDate,
      receipt_url receiptUrl, receipt_proof_key IS NOT NULL hasReceipt,
      receipt_proof_name receiptName, status, created_by createdBy, created_at createdAt
     FROM expenses WHERE event_id = ? AND status != 'reversed'
     ORDER BY expense_date DESC, created_at DESC`,
  ).bind(EVENT_ID).all();
  return Response.json({ expenses: rows.results });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest(request)))
    return Response.json({ error: "Administrator access required." }, { status: 401 });
  const body = await request.formData();
  const category = cleanText(body.get("category"), 50);
  const vendor = cleanText(body.get("vendor"), 100);
  const description = cleanText(body.get("description"), 300);
  const amount = wholeNumber(body.get("amount"), 1);
  const expenseDate = cleanText(body.get("expenseDate"), 10);
  const receiptUrl = cleanText(body.get("receiptUrl"), 500);
  const receipt = body.get("receiptImage");

  if (!EXPENSE_CATEGORIES.includes(category as (typeof EXPENSE_CATEGORIES)[number]) || !vendor || !description || amount === null || !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate))
    return Response.json({ error: "Complete all required expense fields." }, { status: 400 });
  if (receiptUrl && !/^https:\/\//i.test(receiptUrl))
    return Response.json({ error: "Receipt link must use HTTPS." }, { status: 400 });
  const hasReceipt = receipt instanceof File && receipt.size > 0;
  if (hasReceipt && (!IMAGE_TYPES.has(receipt.type) || receipt.size > MAX_RECEIPT_BYTES))
    return Response.json({ error: "Upload a JPG, PNG or WebP receipt image up to 1 MB." }, { status: 400 });

  await ensureDatabase();
  const d1 = getD1();
  const id = crypto.randomUUID();
  const actor = await adminActor(request);
  const receiptKey = hasReceipt ? `expenses/${EVENT_ID}/${id}/${crypto.randomUUID()}` : null;
  const proofStore = (env as unknown as { PAYMENT_PROOFS?: KVNamespace }).PAYMENT_PROOFS;
  if (hasReceipt && !proofStore) throw new Error("Workers KV binding `PAYMENT_PROOFS` is unavailable.");
  if (hasReceipt && receiptKey)
    await proofStore!.put(receiptKey, await receipt.arrayBuffer(), {
      metadata: { originalName: receipt.name, contentType: receipt.type, uploadedBy: actor, kind: "expense-receipt" },
    });

  try {
    await d1.batch([
      d1.prepare(
        `INSERT INTO expenses
        (id, event_id, category, vendor, description, amount, expense_date, receipt_url,
         receipt_proof_key, receipt_proof_name, receipt_proof_type, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)`,
      ).bind(id, EVENT_ID, category, vendor, description, amount, expenseDate, receiptUrl,
        receiptKey, hasReceipt ? receipt.name : null, hasReceipt ? receipt.type : null, actor),
      d1.prepare(
        `INSERT INTO audit_log (id, entity_type, entity_id, action, actor, details)
         VALUES (?, 'expense', ?, 'created', ?, ?)`,
      ).bind(crypto.randomUUID(), id, actor, JSON.stringify({ amount, category, hasReceipt })),
    ]);
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    if (receiptKey) await proofStore?.delete(receiptKey);
    return Response.json({ error: error instanceof Error ? error.message : "Could not save expense." }, { status: 500 });
  }
}
