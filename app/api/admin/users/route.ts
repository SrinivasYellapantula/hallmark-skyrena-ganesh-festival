import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { authorize } from "../../../lib/auth";
import { BLOCKS } from "../../../lib/constants";
import { cleanText } from "../../../lib/server";

export async function GET(request: Request) {
  const auth = await authorize(request, ["admin"]); if ("response" in auth) return auth.response;
  await ensureDatabase();
  const rows = await getD1().prepare(`SELECT id, email, display_name displayName, role, block_no blockNo,
    active, created_at createdAt FROM app_users ORDER BY active DESC, role, block_no, display_name`).all();
  return Response.json({ users: rows.results });
}

export async function POST(request: Request) {
  const auth = await authorize(request, ["admin"]); if ("response" in auth) return auth.response;
  const body = await request.json() as Record<string, unknown>;
  const email = cleanText(body.email, 160).toLowerCase();
  const displayName = cleanText(body.displayName, 100);
  const role = cleanText(body.role, 10);
  const blockNo = cleanText(body.blockNo, 2).toUpperCase();
  if (!/^\S+@\S+\.\S+$/.test(email) || !displayName || !["admin", "block"].includes(role))
    return Response.json({ error: "Enter a valid name, email and role." }, { status: 400 });
  if (role === "block" && !BLOCKS.includes(blockNo as (typeof BLOCKS)[number]))
    return Response.json({ error: "Block users must be assigned to A, B, C, D or E." }, { status: 400 });
  await ensureDatabase(); const d1 = getD1(); const id = crypto.randomUUID();
  await d1.batch([
    d1.prepare(`INSERT INTO app_users (id,email,display_name,role,block_no,active,created_by)
      VALUES (?,?,?,?,?,1,?) ON CONFLICT(email) DO UPDATE SET display_name=excluded.display_name,
      role=excluded.role, block_no=excluded.block_no, active=1, updated_at=CURRENT_TIMESTAMP`)
      .bind(id,email,displayName,role,role === "block" ? blockNo : null,auth.user.email),
    d1.prepare(`INSERT INTO audit_log (id,entity_type,entity_id,action,actor,details)
      VALUES (?,'app_user',?,'upserted',?,?)`).bind(crypto.randomUUID(),id,auth.user.email,JSON.stringify({email,role,blockNo}))
  ]);
  return Response.json({ id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await authorize(request, ["admin"]); if ("response" in auth) return auth.response;
  const body = await request.json() as Record<string, unknown>; const id = cleanText(body.id,80);
  const active = body.active === true ? 1 : 0; if (!id) return Response.json({error:"User id required."},{status:400});
  await ensureDatabase(); await getD1().prepare(`UPDATE app_users SET active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(active,id).run();
  return Response.json({ok:true});
}
