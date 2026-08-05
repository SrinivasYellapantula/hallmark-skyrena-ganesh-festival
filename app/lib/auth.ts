import { ensureDatabase } from "../../db/initialize";
import { getD1 } from "../../db";
import { BLOCKS } from "./constants";
import { env } from "cloudflare:workers";

export type AppUser = { id: string; email: string; displayName: string; role: "admin" | "block"; blockNo: string | null };

function headerEmail(request: Request) {
  const email = request.headers.get("cf-access-authenticated-user-email")?.trim().toLowerCase();
  if (email) return email;
  const host = new URL(request.url).hostname;
  return host === "localhost" || host === "127.0.0.1" ? "local-admin@hallmarkskyrena.local" : null;
}

function configuredAdmins() {
  const value = (env as unknown as Record<string, unknown>).ADMIN_EMAILS;
  return (typeof value === "string" ? value : "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}

export async function getAppUser(request: Request): Promise<AppUser | null> {
  const email = headerEmail(request);
  if (!email) return null;
  const host = new URL(request.url).hostname;
  if (host === "localhost" || host === "127.0.0.1" || configuredAdmins().includes(email)) {
    return { id: "bootstrap-admin", email, displayName: email.split("@")[0], role: "admin", blockNo: null };
  }
  await ensureDatabase();
  const row = await getD1().prepare(
    `SELECT id, email, display_name displayName, role, block_no blockNo
     FROM app_users WHERE email = ? AND active = 1 LIMIT 1`,
  ).bind(email).first<AppUser>();
  if (!row || !["admin", "block"].includes(row.role)) return null;
  if (row.role === "block" && !BLOCKS.includes(row.blockNo as (typeof BLOCKS)[number])) return null;
  return row;
}

export async function authorize(request: Request, roles: Array<AppUser["role"]> = ["admin", "block"]) {
  const user = await getAppUser(request);
  if (!user) return { response: Response.json({ error: "Your account has not been granted access." }, { status: 401 }) } as const;
  if (!roles.includes(user.role)) return { response: Response.json({ error: "Administrator access required." }, { status: 403 }) } as const;
  return { user } as const;
}

export function scopedBlock(user: AppUser, requested: unknown) {
  return user.role === "block" ? user.blockNo : String(requested ?? "").trim().toUpperCase();
}
