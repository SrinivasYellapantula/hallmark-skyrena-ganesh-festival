import { ensureDatabase } from "../../db/initialize";
import { getD1 } from "../../db";
import { BLOCKS } from "./constants";
import { hashSessionToken } from "./passwords";

export const SESSION_COOKIE = "ganesh_session";
export const SESSION_SECONDS = 12 * 60 * 60;

export type AppUser = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "block" | "cultural";
  blockNo: string | null;
};

export function cookieValue(request: Request, name: string) {
  const cookies = request.headers.get("cookie") ?? "";
  for (const item of cookies.split(";")) {
    const [key, ...parts] = item.trim().split("=");
    if (key === name) return decodeURIComponent(parts.join("="));
  }
  return null;
}

export function sessionCookie(token: string, request: Request, maxAge = SESSION_SECONDS) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export async function getAppUser(request: Request): Promise<AppUser | null> {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  await ensureDatabase();
  const tokenHash = await hashSessionToken(token);
  const row = await getD1().prepare(
    `SELECT u.id, u.username, u.display_name displayName, u.role, u.block_no blockNo
     FROM app_sessions s JOIN app_users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP AND u.active = 1 LIMIT 1`,
  ).bind(tokenHash).first<AppUser>();
  if (!row || !row.username || !["admin", "block", "cultural"].includes(row.role)) return null;
  if (row.role === "block" && !BLOCKS.includes(row.blockNo as (typeof BLOCKS)[number])) return null;
  return row;
}

export async function authorize(request: Request, roles: Array<AppUser["role"]> = ["admin", "block"]) {
  const user = await getAppUser(request);
  if (!user) return { response: Response.json({ error: "Please sign in to continue." }, { status: 401 }) } as const;
  if (!roles.includes(user.role)) return { response: Response.json({ error: "You do not have access to this area." }, { status: 403 }) } as const;
  return { user } as const;
}

export function scopedBlock(user: AppUser, requested: unknown) {
  return user.role === "block" ? user.blockNo : String(requested ?? "").trim().toUpperCase();
}
