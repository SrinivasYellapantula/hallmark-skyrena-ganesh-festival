import { env } from "cloudflare:workers";
import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { authorize, isPortalOwner } from "../../../lib/auth";
import { EVENT_ID } from "../../../lib/constants";
import { cleanText } from "../../../lib/server";

const RESET_CONFIRMATION = "RESET FESTIVAL DATA";

export async function POST(request: Request) {
  const auth = await authorize(request, ["admin"]);
  if ("response" in auth) return auth.response;
  if (!isPortalOwner(auth.user))
    return Response.json({ error: "Portal Admin access required." }, { status: 403 });

  const body = await request.json() as Record<string, unknown>;
  if (cleanText(body.confirmation, 80).toUpperCase() !== RESET_CONFIRMATION)
    return Response.json({ error: `Type ${RESET_CONFIRMATION} to confirm.` }, { status: 400 });
  const removeFlatMaster = body.removeFlatMaster === true;

  const proofStore = (env as unknown as { PAYMENT_PROOFS?: KVNamespace }).PAYMENT_PROOFS;
  if (!proofStore) return Response.json({ error: "Private proof storage is unavailable; nothing was erased." }, { status: 503 });

  await ensureDatabase();
  const d1 = getD1();
  const counts = await d1.prepare(
    `SELECT
      (SELECT COUNT(*) FROM registrations WHERE event_id=?) registrations,
      (SELECT COUNT(*) FROM expenses WHERE event_id=?) expenses,
      (SELECT COUNT(*) FROM cultural_programmes WHERE event_id=?) programmes,
      (SELECT COUNT(*) FROM meeting_minutes WHERE event_id=?) meetings,
      (SELECT COUNT(*) FROM flats WHERE event_id=? AND occupied=1) occupiedFlats`,
  ).bind(EVENT_ID, EVENT_ID, EVENT_ID, EVENT_ID, EVENT_ID).first<Record<string, number>>();

  const removedFiles = await deleteStoredFiles(proofStore);
  const flatStatement = removeFlatMaster
    ? d1.prepare("DELETE FROM flats WHERE event_id=?").bind(EVENT_ID)
    : d1.prepare(`UPDATE flats SET visit_status='pending',visit_notes='',last_visited_at=NULL,
        updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE event_id=?`).bind(auth.user.username, EVENT_ID);

  await d1.batch([
    d1.prepare("DELETE FROM donations WHERE registration_id IN (SELECT id FROM registrations WHERE event_id=?)").bind(EVENT_ID),
    d1.prepare("DELETE FROM registrations WHERE event_id=?").bind(EVENT_ID),
    d1.prepare("DELETE FROM expenses WHERE event_id=?").bind(EVENT_ID),
    d1.prepare("DELETE FROM cultural_programmes WHERE event_id=?").bind(EVENT_ID),
    d1.prepare("DELETE FROM meeting_action_items WHERE meeting_id IN (SELECT id FROM meeting_minutes WHERE event_id=?)").bind(EVENT_ID),
    d1.prepare("DELETE FROM meeting_minutes WHERE event_id=?").bind(EVENT_ID),
    flatStatement,
    d1.prepare(`DELETE FROM audit_log WHERE entity_type IN
      ('registration','expense','meeting_minutes','occupied_flat','occupied_flats','portal_reset')`),
    d1.prepare(`INSERT INTO audit_log(id,entity_type,entity_id,action,actor,details)
      VALUES(?,'portal_reset',?,'test_data_cleared',?,?)`).bind(
        crypto.randomUUID(), EVENT_ID, auth.user.username,
        JSON.stringify({ removeFlatMaster, removedFiles, counts: counts ?? {} }),
      ),
  ]);

  return Response.json({ ok: true, removeFlatMaster, removedFiles, counts: counts ?? {} });
}

async function deleteStoredFiles(store: KVNamespace) {
  const prefixes = [`${EVENT_ID}/`, `expenses/${EVENT_ID}/`];
  let removed = 0;
  for (const prefix of prefixes) {
    let cursor: string | undefined;
    do {
      const page = await store.list({ prefix, cursor });
      for (let index = 0; index < page.keys.length; index += 20) {
        const keys = page.keys.slice(index, index + 20);
        await Promise.all(keys.map((item) => store.delete(item.name)));
        removed += keys.length;
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  }
  return removed;
}
