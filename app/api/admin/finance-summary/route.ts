import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { getAppUser, isPortalOwner } from "../../../lib/auth";
import { EVENT_ID } from "../../../lib/constants";
import { cleanText, wholeNumber } from "../../../lib/server";

export async function GET(request: Request) {
  const user = await getAppUser(request);
  if (user?.role !== "admin") return Response.json({ error: "Administrator access required." }, { status: 401 });
  await ensureDatabase();
  const d1 = getD1();
  const [settings, collections, expenses] = await Promise.all([
    d1.prepare(`SELECT opening_balance openingBalance,opening_balance_note openingBalanceNote,
      updated_by updatedBy,updated_at updatedAt FROM event_finance_settings WHERE event_id=?`).bind(EVENT_ID).first(),
    d1.prepare(`SELECT
      COALESCE(SUM(CASE WHEN d.status='verified' THEN d.amount ELSE 0 END),0) verifiedCollections,
      COALESCE(SUM(CASE WHEN d.status='pending' THEN d.amount ELSE 0 END),0) pendingCollections
      FROM registrations r JOIN donations d ON d.registration_id=r.id
      WHERE r.event_id=? AND r.status!='cancelled' AND d.status!='reversed'`).bind(EVENT_ID).first(),
    d1.prepare(`SELECT COALESCE(SUM(amount),0) recordedExpenses,COUNT(*) expenseCount
      FROM expenses WHERE event_id=? AND status!='reversed'`).bind(EVENT_ID).first(),
  ]);
  const openingBalance = Number(settings?.openingBalance ?? 0);
  const verifiedCollections = Number(collections?.verifiedCollections ?? 0);
  const pendingCollections = Number(collections?.pendingCollections ?? 0);
  const recordedExpenses = Number(expenses?.recordedExpenses ?? 0);
  const availableFunds = openingBalance + verifiedCollections;
  const netPosition = availableFunds - recordedExpenses;
  return Response.json({
    openingBalance,
    openingBalanceNote: String(settings?.openingBalanceNote ?? ""),
    updatedBy: settings?.updatedBy ?? null,
    updatedAt: settings?.updatedAt ?? null,
    verifiedCollections,
    pendingCollections,
    recordedExpenses,
    expenseCount: Number(expenses?.expenseCount ?? 0),
    availableFunds,
    remainingFunds: Math.max(netPosition, 0),
    deficit: Math.max(-netPosition, 0),
    canEditOpeningBalance: isPortalOwner(user),
  });
}

export async function PATCH(request: Request) {
  const user = await getAppUser(request);
  if (!isPortalOwner(user)) return Response.json({ error: "Only the Portal Admin can change the opening balance." }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const openingBalance = wholeNumber(body.openingBalance, 0, 10_000_000);
  const openingBalanceNote = cleanText(body.openingBalanceNote, 300);
  if (openingBalance === null) return Response.json({ error: "Enter a valid non-negative opening balance." }, { status: 400 });
  await ensureDatabase();
  const d1 = getD1();
  await d1.batch([
    d1.prepare(`INSERT INTO event_finance_settings(event_id,opening_balance,opening_balance_note,updated_by)
      VALUES(?,?,?,?) ON CONFLICT(event_id) DO UPDATE SET opening_balance=excluded.opening_balance,
      opening_balance_note=excluded.opening_balance_note,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`)
      .bind(EVENT_ID, openingBalance, openingBalanceNote, user!.username),
    d1.prepare(`INSERT INTO audit_log(id,entity_type,entity_id,action,actor,details)
      VALUES(?,'event_finance',?,'opening_balance_updated',?,?)`)
      .bind(crypto.randomUUID(), EVENT_ID, user!.username, JSON.stringify({ openingBalance, openingBalanceNote })),
  ]);
  return Response.json({ ok: true });
}
