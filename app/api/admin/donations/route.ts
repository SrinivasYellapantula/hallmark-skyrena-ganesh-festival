import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { adminEmail, cleanText, isAdminRequest } from "../../../lib/server";

export async function PATCH(request: Request) {
  if (!isAdminRequest(request)) return Response.json({ error: "Administrator access required." }, { status: 401 });
  const body = (await request.json()) as { registrationId?: unknown; action?: unknown };
  const registrationId = cleanText(body.registrationId, 80);
  const action = cleanText(body.action, 20);
  if (!registrationId || !["verify", "reverse"].includes(action)) {
    return Response.json({ error: "Invalid verification request." }, { status: 400 });
  }

  await ensureDatabase();
  const d1 = getD1();
  const actor = adminEmail(request);
  const donationStatus = action === "verify" ? "verified" : "reversed";
  const registrationStatus = action === "verify" ? "verified" : "cancelled";
  await d1.batch([
    d1
      .prepare(
        `UPDATE donations SET status = ?, verified_at = CURRENT_TIMESTAMP, verified_by = ?
         WHERE registration_id = ? AND status != 'reversed'`,
      )
      .bind(donationStatus, actor, registrationId),
    d1
      .prepare("UPDATE registrations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(registrationStatus, registrationId),
    d1
      .prepare(
        `INSERT INTO audit_log (id, entity_type, entity_id, action, actor, details)
         VALUES (?, 'registration', ?, ?, ?, '{}')`,
      )
      .bind(crypto.randomUUID(), registrationId, action, actor),
  ]);
  return Response.json({ ok: true });
}
