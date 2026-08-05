import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { SESSION_SECONDS, sessionCookie } from "../../../lib/auth";
import { hashSessionToken, newSessionToken, normalizeUsername, validUsername, verifyPassword } from "../../../lib/passwords";

const DUMMY_SALT = "Ad/XCSp5mCEiqVpPV2vPYw==";
const DUMMY_HASH = "4/sr/Z8IiGh9/JD63YaHh5HazuRqjTmb/VaPQJxkGfU=";
const AUTH_HEADERS = { "x-auth-engine": "node-pbkdf2-async-v3" };

export async function POST(request: Request) {
  await ensureDatabase();
  const body = await request.json() as Record<string, unknown>;
  const username = normalizeUsername(body.username);
  const password = String(body.password ?? "");
  if (!validUsername(username) || !password || password.length > 200)
    return Response.json({ error: "Enter a valid username and password." }, { status: 400, headers: AUTH_HEADERS });

  const d1 = getD1();
  const attempt = await d1.prepare(
    `SELECT attempts, window_started_at > datetime('now','-15 minutes') withinWindow
     FROM login_attempts WHERE username = ?`,
  ).bind(username).first<{ attempts: number; withinWindow: number }>();
  if (attempt?.withinWindow && attempt.attempts >= 5)
    return Response.json({ error: "Too many failed attempts. Please wait 15 minutes and try again." }, { status: 429, headers: AUTH_HEADERS });

  const user = await d1.prepare(
    `SELECT id, password_hash passwordHash, password_salt passwordSalt
     FROM app_users WHERE username = ? AND active = 1 LIMIT 1`,
  ).bind(username).first<{ id: string; passwordHash: string | null; passwordSalt: string | null }>();
  let valid = false;
  try {
    valid = await verifyPassword(password, user?.passwordSalt ?? DUMMY_SALT, user?.passwordHash ?? DUMMY_HASH);
  } catch (error) {
    console.error("Native password verification failed", error);
    return Response.json({ error: "Login verification is temporarily unavailable." }, { status: 503, headers: AUTH_HEADERS });
  }
  if (!user || !valid) {
    await d1.prepare(
      `INSERT INTO login_attempts(username,attempts,window_started_at,updated_at)
       VALUES (?,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT(username) DO UPDATE SET
         attempts=CASE WHEN window_started_at <= datetime('now','-15 minutes') THEN 1 ELSE attempts+1 END,
         window_started_at=CASE WHEN window_started_at <= datetime('now','-15 minutes') THEN CURRENT_TIMESTAMP ELSE window_started_at END,
         updated_at=CURRENT_TIMESTAMP`,
    ).bind(username).run();
    return Response.json({ error: "Incorrect username or password." }, { status: 401, headers: AUTH_HEADERS });
  }

  const token = newSessionToken();
  const tokenHash = await hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString().replace("T", " ").slice(0, 19);
  await d1.batch([
    d1.prepare("DELETE FROM login_attempts WHERE username = ?").bind(username),
    d1.prepare("DELETE FROM app_sessions WHERE expires_at <= CURRENT_TIMESTAMP"),
    d1.prepare("INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES (?,?,?)").bind(tokenHash, user.id, expiresAt),
  ]);
  return Response.json({ ok: true }, { headers: { ...AUTH_HEADERS, "set-cookie": sessionCookie(token, request) } });
}
