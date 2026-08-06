import { env } from "cloudflare:workers";
import { getD1 } from "../../../../../db";
import { ensureDatabase } from "../../../../../db/initialize";
import { EVENT_ID } from "../../../../lib/constants";
import { EXPENSE_CATEGORIES } from "../../../../lib/expense-categories";
import { adminActor, cleanText, isAdminRequest, wholeNumber } from "../../../../lib/server";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_RECEIPT_BYTES = 1024 * 1024;
type ExistingExpense = { receiptProofKey: string | null; receiptProofName: string | null; receiptProofType: string | null };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest(request)))
    return Response.json({ error: "Administrator access required." }, { status: 401 });
  await ensureDatabase();
  const { id } = await params;
  const expense = await getD1().prepare(
    `SELECT id, category, vendor, description, amount, expense_date expenseDate,
      receipt_url receiptUrl, receipt_proof_key IS NOT NULL hasReceipt,
      receipt_proof_name receiptName, status, created_by createdBy, created_at createdAt
     FROM expenses WHERE id = ? AND event_id = ? AND status != 'reversed' LIMIT 1`,
  ).bind(id, EVENT_ID).first();
  if (!expense) return Response.json({ error: "Expense not found." }, { status: 404 });
  return Response.json({ expense });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest(request)))
    return Response.json({ error: "Administrator access required." }, { status: 401 });
  await ensureDatabase();
  const { id } = await params;
  const d1 = getD1();
  const existing = await d1.prepare(
    `SELECT receipt_proof_key receiptProofKey, receipt_proof_name receiptProofName,
      receipt_proof_type receiptProofType FROM expenses
     WHERE id = ? AND event_id = ? AND status != 'reversed' LIMIT 1`,
  ).bind(id, EVENT_ID).first<ExistingExpense>();
  if (!existing) return Response.json({ error: "Expense not found." }, { status: 404 });

  const body = await request.formData();
  const category = cleanText(body.get("category"), 50);
  const vendor = cleanText(body.get("vendor"), 100);
  const description = cleanText(body.get("description"), 300);
  const amount = wholeNumber(body.get("amount"), 1);
  const expenseDate = cleanText(body.get("expenseDate"), 10);
  const receiptUrl = cleanText(body.get("receiptUrl"), 500);
  const receiptEntry = body.get("receiptImage");
  const receipt = receiptEntry instanceof File && receiptEntry.size > 0 ? receiptEntry : null;
  const removeReceipt = body.get("removeReceipt") === "true";
  if (!EXPENSE_CATEGORIES.includes(category as (typeof EXPENSE_CATEGORIES)[number]) || !vendor || !description || amount === null || !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate))
    return Response.json({ error: "Complete all required expense fields." }, { status: 400 });
  if (receiptUrl && !/^https:\/\//i.test(receiptUrl))
    return Response.json({ error: "Receipt link must use HTTPS." }, { status: 400 });
  if (receipt && (!IMAGE_TYPES.has(receipt.type) || receipt.size > MAX_RECEIPT_BYTES))
    return Response.json({ error: "Upload a JPG, PNG or WebP receipt image up to 1 MB." }, { status: 400 });

  const actor = await adminActor(request);
  const proofStore = (env as unknown as { PAYMENT_PROOFS?: KVNamespace }).PAYMENT_PROOFS;
  if ((receipt || removeReceipt) && !proofStore) throw new Error("Workers KV binding `PAYMENT_PROOFS` is unavailable.");
  const newReceiptKey = receipt ? `expenses/${EVENT_ID}/${id}/${crypto.randomUUID()}` : null;
  if (receipt && newReceiptKey)
    await proofStore!.put(newReceiptKey, await receipt.arrayBuffer(), {
      metadata: { originalName: receipt.name, contentType: receipt.type, uploadedBy: actor, kind: "expense-receipt" },
    });

  const receiptKey = receipt ? newReceiptKey : removeReceipt ? null : existing.receiptProofKey;
  const receiptName = receipt ? receipt.name : removeReceipt ? null : existing.receiptProofName;
  const receiptType = receipt ? receipt.type : removeReceipt ? null : existing.receiptProofType;
  try {
    await d1.batch([
      d1.prepare(
        `UPDATE expenses SET category = ?, vendor = ?, description = ?, amount = ?, expense_date = ?,
          receipt_url = ?, receipt_proof_key = ?, receipt_proof_name = ?, receipt_proof_type = ?
         WHERE id = ? AND event_id = ?`,
      ).bind(category, vendor, description, amount, expenseDate, receiptUrl, receiptKey, receiptName, receiptType, id, EVENT_ID),
      d1.prepare(
        `INSERT INTO audit_log (id, entity_type, entity_id, action, actor, details)
         VALUES (?, 'expense', ?, 'updated', ?, ?)`,
      ).bind(crypto.randomUUID(), id, actor, JSON.stringify({ amount, category, replacedReceipt: Boolean(receipt), removedReceipt: removeReceipt })),
    ]);
  } catch (error) {
    if (newReceiptKey) await proofStore?.delete(newReceiptKey);
    return Response.json({ error: error instanceof Error ? error.message : "Could not update expense." }, { status: 500 });
  }
  if (existing.receiptProofKey && existing.receiptProofKey !== receiptKey)
    await proofStore?.delete(existing.receiptProofKey);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest(request)))
    return Response.json({ error: "Administrator access required." }, { status: 401 });
  await ensureDatabase();
  const { id } = await params;
  const d1 = getD1();
  const existing = await d1.prepare(
    `SELECT category,amount,status,receipt_proof_key receiptProofKey FROM expenses
     WHERE id = ? AND event_id = ? AND status != 'reversed' LIMIT 1`,
  ).bind(id, EVENT_ID).first<{ category: string; amount: number; status: string; receiptProofKey: string | null }>();
  if (!existing) return Response.json({ error: "Expense not found." }, { status: 404 });
  const actor = await adminActor(request);
  await d1.batch([
    d1.prepare("UPDATE expenses SET status='reversed' WHERE id = ? AND event_id = ?").bind(id, EVENT_ID),
    d1.prepare(`INSERT INTO recycle_bin(id,event_id,entity_type,entity_id,entity_label,restore_data,deleted_by)
      VALUES(?,?,'expense',?,?,?,?)`).bind(
        crypto.randomUUID(),EVENT_ID,id,`${existing.category} · ₹${existing.amount}`,
        JSON.stringify({ status: existing.status }),actor,
      ),
    d1.prepare(
      `INSERT INTO audit_log (id, entity_type, entity_id, action, actor, details)
       VALUES (?, 'expense', ?, 'moved_to_recycle_bin', ?, '{}')`,
    ).bind(crypto.randomUUID(), id, actor),
  ]);
  return Response.json({ ok: true, recycled: true });
}
