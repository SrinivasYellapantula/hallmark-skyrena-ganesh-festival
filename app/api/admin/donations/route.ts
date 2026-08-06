import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { EVENT_ID } from "../../../lib/constants";
import { adminActor, cleanText, isAdminRequest } from "../../../lib/server";

export async function PATCH(request: Request) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "Administrator access required." }, { status: 401 });
  const body = (await request.json()) as { registrationId?: unknown; action?: unknown; reason?: unknown };
  const registrationId = cleanText(body.registrationId, 80);
  const action = cleanText(body.action, 20);
  const reason = cleanText(body.reason, 300);
  if (!registrationId || !["verify", "request_correction"].includes(action)) {
    return Response.json({ error: "Invalid verification request." }, { status: 400 });
  }
  if (action === "request_correction" && !reason)
    return Response.json({ error: "Enter what needs to be corrected." }, { status: 400 });

  await ensureDatabase();
  const d1 = getD1();
  const actor = await adminActor(request);
  const registration = await d1.prepare("SELECT status FROM registrations WHERE id=? AND event_id=?")
    .bind(registrationId, EVENT_ID).first<{ status: string }>();
  if (!registration) return Response.json({ error: "Submission not found." }, { status: 404 });
  if (registration.status !== "submitted")
    return Response.json({ error: "Only submissions awaiting verification can be updated." }, { status: 409 });

  const registrationStatus = action === "verify" ? "verified" : "correction_requested";
  const statements = [
    d1.prepare("UPDATE registrations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND event_id = ?")
      .bind(registrationStatus, registrationId, EVENT_ID),
    d1.prepare(
      `INSERT INTO audit_log (id, entity_type, entity_id, action, actor, details)
       VALUES (?, 'registration', ?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), registrationId, action === "verify" ? "verified" : "correction_requested", actor, JSON.stringify({ reason })),
  ];
  if (action === "verify") statements.unshift(
    d1.prepare(
      `UPDATE donations SET status = 'verified', verified_at = CURRENT_TIMESTAMP, verified_by = ?
       WHERE registration_id = ? AND status != 'reversed'`,
    ).bind(actor, registrationId),
  );
  await d1.batch([
    ...statements,
  ]);
  return Response.json({ ok: true });
}
