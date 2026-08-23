import { env } from "cloudflare:workers";
import { getD1 } from "../../../../../db";
import { ensureDatabase } from "../../../../../db/initialize";
import { authorize } from "../../../../lib/auth";
import { EVENT_ID } from "../../../../lib/constants";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize(request,["admin","cultural"]);
  if ("response" in auth) return auth.response;
  await ensureDatabase();
  const { id } = await context.params;
  const row = await getD1().prepare(`SELECT audio_key audioKey,audio_name audioName,audio_type audioType
    FROM cultural_programmes WHERE id=? AND event_id=?`).bind(id,EVENT_ID).first<{audioKey:string|null;audioName:string|null;audioType:string|null}>();
  if (!row?.audioKey) return Response.json({ error: "Audio track not found." }, { status: 404 });
  const store = (env as unknown as { PAYMENT_PROOFS?: KVNamespace }).PAYMENT_PROOFS;
  const object = await store?.get(row.audioKey, "arrayBuffer");
  if (!object) return Response.json({ error: "Audio track not found." }, { status: 404 });
  return new Response(object, { headers: {
    "content-type": row.audioType || "application/octet-stream",
    "content-disposition": `inline; filename="${(row.audioName || "audio-track").replaceAll('"', '')}"`,
    "cache-control": "private, no-store",
  }});
}
