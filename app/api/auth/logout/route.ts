import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { cookieValue, SESSION_COOKIE, sessionCookie } from "../../../lib/auth";
import { hashSessionToken } from "../../../lib/passwords";

export async function POST(request: Request) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (token) {
    await ensureDatabase();
    await getD1().prepare("DELETE FROM app_sessions WHERE token_hash = ?").bind(await hashSessionToken(token)).run();
  }
  return Response.json({ ok: true }, { headers: { "set-cookie": sessionCookie("", request, 0) } });
}
