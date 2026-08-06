import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { authorize, isPortalOwner, sessionCookie } from "../../../lib/auth";
import { BLOCKS } from "../../../lib/constants";
import { hashPassword, normalizeUsername, validUsername } from "../../../lib/passwords";
import { cleanText } from "../../../lib/server";

export async function GET(request: Request) {
  const auth = await authorize(request, ["admin"]);
  if ("response" in auth) return auth.response;
  await ensureDatabase();
  const rows = await getD1().prepare(
    `SELECT id, username, display_name displayName, role, block_no blockNo,
      active, created_at createdAt FROM app_users
     WHERE username IS NOT NULL ORDER BY active DESC, role, block_no, display_name`,
  ).all();
  return Response.json({ users: rows.results, portalOwner: isPortalOwner(auth.user) });
}

export async function POST(request: Request) {
  const auth = await authorize(request, ["admin"]);
  if ("response" in auth) return auth.response;
  const body = await request.json() as Record<string, unknown>;
  const username = normalizeUsername(body.username);
  const password = String(body.password ?? "");
  const displayName = cleanText(body.displayName, 100);
  const role = cleanText(body.role, 10);
  const blockNo = cleanText(body.blockNo, 2).toUpperCase();
  if (!validUsername(username) || !displayName || !["admin", "block", "cultural"].includes(role))
    return Response.json({ error: "Enter a valid name, username and role." }, { status: 400 });
  if (password.length < 8 || password.length > 200)
    return Response.json({ error: "Passwords must contain at least 8 characters." }, { status: 400 });
  if (role === "block" && !BLOCKS.includes(blockNo as (typeof BLOCKS)[number]))
    return Response.json({ error: "Block users must be assigned to A, B, C, D or E." }, { status: 400 });

  await ensureDatabase();
  const d1 = getD1();
  const existing = await d1.prepare("SELECT id,role FROM app_users WHERE username = ?").bind(username).first<{ id: string; role: string }>();
  const portalOwner = isPortalOwner(auth.user);
  if (!portalOwner && (role === "admin" || existing?.role === "admin"))
    return Response.json({ error: "Only the Portal Admin can create or modify Admin accounts." }, { status: 403 });
  if (existing?.id === "initial-admin" && role !== "admin")
    return Response.json({ error: "The Portal Admin account must retain super-admin access." }, { status: 400 });
  const id = existing?.id ?? crypto.randomUUID();
  const credentials = await hashPassword(password);
  const statements = existing ? [
    d1.prepare(
      `UPDATE app_users SET display_name=?,role=?,block_no=?,password_hash=?,password_salt=?,
       password_updated_at=CURRENT_TIMESTAMP,active=1,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    ).bind(displayName, role, role === "block" ? blockNo : null, credentials.hash, credentials.salt, id),
    d1.prepare("DELETE FROM app_sessions WHERE user_id = ?").bind(id),
  ] : [
    d1.prepare(
      `INSERT INTO app_users
       (id,email,username,password_hash,password_salt,password_updated_at,display_name,role,block_no,active,created_by)
       VALUES (?,?,?,?,?,CURRENT_TIMESTAMP,?,?,?,1,?)`,
    ).bind(id, `${username}@local`, username, credentials.hash, credentials.salt, displayName, role, role === "block" ? blockNo : null, auth.user.username),
  ];
  statements.push(d1.prepare(
    `INSERT INTO audit_log(id,entity_type,entity_id,action,actor,details)
     VALUES (?,'app_user',?,'credentials_updated',?,?)`,
  ).bind(crypto.randomUUID(), id, auth.user.username, JSON.stringify({ username, role, blockNo: role === "block" ? blockNo : null })));
  await d1.batch(statements);
  const signedOut = id === auth.user.id;
  return Response.json(
    { id, signedOut },
    { status: existing ? 200 : 201, ...(signedOut ? { headers: { "set-cookie": sessionCookie("", request, 0) } } : {}) },
  );
}

export async function PATCH(request: Request) {
  const auth = await authorize(request, ["admin"]);
  if ("response" in auth) return auth.response;
  const body = await request.json() as Record<string, unknown>;
  const id = cleanText(body.id, 80);
  const active = body.active === true ? 1 : 0;
  if (!id) return Response.json({ error: "User id required." }, { status: 400 });
  if (id === "initial-admin" && !active) return Response.json({ error: "The Portal Admin account cannot be disabled." }, { status: 400 });
  if (id === auth.user.id && !active) return Response.json({ error: "You cannot disable your own account." }, { status: 400 });
  await ensureDatabase();
  const d1 = getD1();
  const target = await d1.prepare("SELECT role FROM app_users WHERE id=?").bind(id).first<{ role: string }>();
  if (!target) return Response.json({ error: "User not found." }, { status: 404 });
  if (target.role === "admin" && !isPortalOwner(auth.user))
    return Response.json({ error: "Only the Portal Admin can change Admin access." }, { status: 403 });
  await d1.batch([
    d1.prepare("UPDATE app_users SET active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(active, id),
    ...(active ? [] : [d1.prepare("DELETE FROM app_sessions WHERE user_id=?").bind(id)]),
  ]);
  return Response.json({ ok: true });
}
