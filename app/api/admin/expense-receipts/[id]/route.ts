import { env } from "cloudflare:workers";
import { getD1 } from "../../../../../db";
import { ensureDatabase } from "../../../../../db/initialize";
import { EVENT_ID } from "../../../../lib/constants";
import { isAdminRequest } from "../../../../lib/server";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest(request)))
    return Response.json({ error: "Administrator access required." }, { status: 401 });
  await ensureDatabase();
  const { id } = await params;
  const row = await getD1().prepare(
    `SELECT receipt_proof_key receiptKey, receipt_proof_name receiptName, receipt_proof_type receiptType
     FROM expenses WHERE id = ? AND event_id = ? AND status != 'reversed' LIMIT 1`,
  ).bind(id, EVENT_ID).first<{ receiptKey: string | null; receiptName: string | null; receiptType: string | null }>();
  if (!row?.receiptKey) return Response.json({ error: "Receipt not found." }, { status: 404 });
  const proofStore = (env as unknown as { PAYMENT_PROOFS?: KVNamespace }).PAYMENT_PROOFS;
  const object = await proofStore?.get(row.receiptKey, "arrayBuffer");
  if (!object) return Response.json({ error: "Receipt file not found." }, { status: 404 });
  return new Response(object, {
    headers: {
      "content-type": row.receiptType || "application/octet-stream",
      "content-disposition": `inline; filename="${(row.receiptName || "receipt").replaceAll('"', "")}"`,
      "cache-control": "private, no-store",
    },
  });
}
