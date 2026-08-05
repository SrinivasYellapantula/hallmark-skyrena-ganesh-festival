"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { currency } from "../lib/constants";

type Registration = { id: string; referenceNo: string; residentName: string; blockNo: string; flatNo: string; adultCount: number; childCount: number; status: string; amount: number; paymentStatus: string; paymentMethod: string; paymentReference: string; createdAt: string };
type Expense = { id: string; category: string; vendor: string; description: string; amount: number; expenseDate: string; receiptUrl: string; status: string };
type Dashboard = { registrations: Registration[]; expenses: Expense[]; totals: { verified: number; pending: number; submissions: number } };
const blank: Dashboard = { registrations: [], expenses: [], totals: { verified: 0, pending: 0, submissions: 0 } };

export function AdminDashboard() {
  const [data, setData] = useState<Dashboard>(blank);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [showExpense, setShowExpense] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/dashboard");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Unable to load the committee console.");
    setData(payload);
  }, []);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Unable to load the committee console.");
        setData(payload);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load."));
  }, []);
  const visible = useMemo(() => data.registrations.filter((item) => `${item.residentName} ${item.blockNo} ${item.flatNo} ${item.referenceNo}`.toLowerCase().includes(filter.toLowerCase())), [data.registrations, filter]);

  async function updateRegistration(registrationId: string, action: "verify" | "reverse") {
    setBusy(registrationId); setError("");
    try {
      const response = await fetch("/api/admin/donations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ registrationId, action }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Update failed.");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Update failed."); }
    finally { setBusy(""); }
  }

  return (
    <section className="wrap admin-shell">
      <div className="admin-heading"><div><div className="eyebrow"><span /> Restricted area</div><h1>Committee console</h1><p>Verify collections, record expenses and keep the public ledger current.</p></div><button className="button primary" onClick={() => setShowExpense(true)}>+ Record expense</button></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="admin-metrics"><article><span>Verified collections</span><strong>{currency(Number(data.totals.verified))}</strong></article><article><span>Pending verification</span><strong>{currency(Number(data.totals.pending))}</strong></article><article><span>Household submissions</span><strong>{data.totals.submissions}</strong></article><article><span>Recorded expenses</span><strong>{currency(data.expenses.reduce((sum, item) => sum + Number(item.amount), 0))}</strong></article></div>
      <div className="admin-card">
        <header><div><span className="card-kicker">Collection queue</span><h2>Household submissions</h2></div><input aria-label="Search submissions" placeholder="Search name, block, flat or reference" value={filter} onChange={(event) => setFilter(event.target.value)} /></header>
        <div className="table-wrap"><table><thead><tr><th>Resident</th><th>Location</th><th>Contribution</th><th>Payment</th><th>Status</th><th>Action</th></tr></thead><tbody>{visible.map((item) => <tr key={item.id}><td><strong>{item.residentName}</strong><small>{item.referenceNo}</small></td><td>Block {item.blockNo} · {item.flatNo}<small>{item.adultCount + item.childCount} attendees</small></td><td><strong>{currency(Number(item.amount))}</strong></td><td>{item.paymentMethod?.replace("_", " ")}<small>{item.paymentReference || "No reference"}</small></td><td><span className={`status ${item.status}`}>{item.status}</span></td><td>{item.status === "submitted" ? <div className="row-actions"><button disabled={busy === item.id} onClick={() => updateRegistration(item.id, "verify")}>Verify</button><button className="danger" disabled={busy === item.id} onClick={() => updateRegistration(item.id, "reverse")}>Reject</button></div> : <span className="done">Complete</span>}</td></tr>)}</tbody></table>{visible.length === 0 && <div className="empty-state"><span>◎</span><p>No matching submissions.</p></div>}</div>
      </div>
      <div className="security-note"><strong>Security checkpoint</strong><p>Change the initial administrator password before sharing the portal. New passwords are salted and hashed, and all active sessions are revoked when a password is reset.</p></div>
      {showExpense && <ExpenseDialog close={() => setShowExpense(false)} saved={async () => { setShowExpense(false); await load(); }} />}
    </section>
  );
}

function ExpenseDialog({ close, saved }: { close: () => void; saved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try { const response = await fetch("/api/admin/expenses", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Could not save expense."); await saved(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save expense."); setBusy(false); }
  }
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="expense-title"><button className="dialog-close" onClick={close} aria-label="Close">×</button><span className="card-kicker">Public ledger</span><h2 id="expense-title">Record an expense</h2><form onSubmit={submit}><label>Category<select name="category" required><option>Decoration</option><option>Annadaanam</option><option>Puja</option><option>Logistics</option><option>Entertainment</option><option>Other</option></select></label><label>Vendor<input name="vendor" required /></label><label>Description<textarea name="description" required rows={3} /></label><div className="field-grid"><label>Amount<input name="amount" required type="number" min="1" /></label><label>Expense date<input name="expenseDate" required type="date" /></label></div><label>Receipt link <span className="optional">optional</span><input name="receiptUrl" type="url" placeholder="https://drive.google.com/…" /></label>{error && <p className="form-error">{error}</p>}<div className="dialog-actions"><button type="button" className="button quiet" onClick={close}>Cancel</button><button className="button primary" disabled={busy}>{busy ? "Saving…" : "Save approved expense"}</button></div></form></div></div>;
}
