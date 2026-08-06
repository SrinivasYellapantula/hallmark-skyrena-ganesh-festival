"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { currency } from "../lib/constants";
import { optimizeImageUpload } from "../lib/client-image";
import { EXPENSE_CATEGORIES } from "../lib/expense-categories";

type Registration = {
  id: string; referenceNo: string; residentName: string; blockNo: string; flatNo: string;
  adultCount: number; childCount: number; status: string; amount: number; paymentStatus: string;
  paymentMethod: string; paymentReference: string; createdAt: string;
};
type Expense = {
  id: string; category: string; vendor: string; description: string; amount: number; expenseDate: string;
  receiptUrl: string; hasReceipt: number; receiptName: string | null; status: string; createdBy: string; createdAt: string;
};
type Dashboard = { registrations: Registration[]; expenses: Expense[]; totals: { verified: number; pending: number; submissions: number }; portalOwner: boolean };
const blank: Dashboard = { registrations: [], expenses: [], totals: { verified: 0, pending: 0, submissions: 0 }, portalOwner: false };

export function AdminDashboard() {
  const [data, setData] = useState<Dashboard>(blank);
  const [filter, setFilter] = useState("");
  const [expenseFilter, setExpenseFilter] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [expenseDialog, setExpenseDialog] = useState<Expense | "new" | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [resetDialog, setResetDialog] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/dashboard");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Unable to load festival accounts.");
    setData(payload);
    setSelectedExpense((selected) => selected
      ? payload.expenses.find((expense: Expense) => expense.id === selected.id) ?? payload.expenses[0] ?? null
      : payload.expenses[0] ?? null);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/dashboard")
      .then(async (response) => ({ response, payload: await response.json() }))
      .then(({ response, payload }) => {
        if (!active) return;
        if (!response.ok) setError(payload.error ?? "Unable to load festival accounts.");
        else {
          setData(payload);
          setSelectedExpense(payload.expenses[0] ?? null);
        }
      })
      .catch(() => active && setError("Unable to load."));
    return () => { active = false; };
  }, []);

  const visible = useMemo(
    () => data.registrations.filter((item) => `${item.residentName} ${item.blockNo} ${item.flatNo} ${item.referenceNo}`.toLowerCase().includes(filter.toLowerCase())),
    [data.registrations, filter],
  );
  const visibleExpenses = useMemo(
    () => data.expenses.filter((item) => `${item.category} ${item.vendor} ${item.description}`.toLowerCase().includes(expenseFilter.toLowerCase())),
    [data.expenses, expenseFilter],
  );

  async function updateRegistration(registrationId: string, action: "verify" | "reverse") {
    setBusy(registrationId); setError("");
    try {
      const response = await fetch("/api/admin/donations", {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ registrationId, action }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Update failed.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Update failed.");
    } finally {
      setBusy("");
    }
  }

  async function deleteExpense(expense: Expense) {
    if (!window.confirm(`Delete the ${expense.category} expense of ${currency(Number(expense.amount))}? This cannot be undone.`)) return;
    setBusy(expense.id); setError("");
    try {
      const response = await fetch(`/api/admin/expenses/${expense.id}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not delete expense.");
      setSelectedExpense(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete expense.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="wrap admin-shell">
      <div className="admin-heading">
        <div><div className="eyebrow"><span />Portal administrator</div><h1>Festival Accounts</h1><p>Verify collections, record expenses and keep the public ledger current.</p></div>
        <div className="admin-heading-actions"><a className="button quiet" href="#expenses">View Expenses</a><button className="button primary" onClick={() => setExpenseDialog("new")}>+ Record Expense</button></div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="admin-metrics">
        <article><span>Verified collections</span><strong>{currency(Number(data.totals.verified))}</strong></article>
        <article><span>Pending verification</span><strong>{currency(Number(data.totals.pending))}</strong></article>
        <article><span>Household submissions</span><strong>{data.totals.submissions}</strong></article>
        <article><span>Recorded expenses</span><strong>{currency(data.expenses.reduce((sum, item) => sum + Number(item.amount), 0))}</strong></article>
      </div>

      <div className="admin-card">
        <header><div><span className="card-kicker">Collection queue</span><h2>Household submissions</h2></div><input aria-label="Search submissions" placeholder="Search name, block, flat or reference" value={filter} onChange={(event) => setFilter(event.target.value)} /></header>
        <div className="table-wrap"><table><thead><tr><th>Resident</th><th>Location</th><th>Contribution</th><th>Payment</th><th>Status</th><th>Action</th></tr></thead><tbody>{visible.map((item) => <tr key={item.id}><td><strong>{item.residentName}</strong><small>{item.referenceNo}</small></td><td>Block {item.blockNo} · {item.flatNo}<small>{item.adultCount + item.childCount} attendees</small></td><td><strong>{currency(Number(item.amount))}</strong></td><td>{item.paymentMethod?.replace("_", " ")}<small>{item.paymentReference || "No reference"}</small></td><td><span className={`status ${item.status}`}>{item.status}</span></td><td>{item.status === "submitted" ? <div className="row-actions"><button disabled={busy === item.id} onClick={() => updateRegistration(item.id, "verify")}>Verify</button><button className="danger" disabled={busy === item.id} onClick={() => updateRegistration(item.id, "reverse")}>Reject</button></div> : <span className="done">Complete</span>}</td></tr>)}</tbody></table>{visible.length === 0 && <div className="empty-state"><span>◎</span><p>No matching submissions.</p></div>}</div>
      </div>

      <div className="admin-card expense-register" id="expenses">
        <header><div><span className="card-kicker">Expense register</span><h2>Recorded Expenses</h2></div><input aria-label="Search expenses" placeholder="Search category, vendor or description" value={expenseFilter} onChange={(event) => setExpenseFilter(event.target.value)} /></header>
        <div className="expense-records">
          <div className="expense-record-list">
            {visibleExpenses.map((expense) => (
              <button key={expense.id} className={selectedExpense?.id === expense.id ? "selected" : ""} onClick={() => setSelectedExpense(expense)}>
                <span><strong>{expense.category}</strong><small>{expense.vendor} · {expense.expenseDate}</small></span>
                <span><strong>{currency(Number(expense.amount))}</strong><small>{expense.hasReceipt ? "Receipt attached" : "No receipt image"}</small></span>
              </button>
            ))}
            {!visibleExpenses.length && <div className="empty-state"><span>◎</span><p>No matching expenses.</p></div>}
          </div>
          {selectedExpense ? (
            <aside className="expense-detail">
              <button className="dialog-close" onClick={() => setSelectedExpense(null)} aria-label="Close expense details">×</button>
              <span className="card-kicker">Expense details</span>
              <h3>{selectedExpense.category}</h3>
              <p>{selectedExpense.description}</p>
              <dl>
                <div><dt>Vendor / Payee</dt><dd>{selectedExpense.vendor}</dd></div>
                <div><dt>Amount</dt><dd>{currency(Number(selectedExpense.amount))}</dd></div>
                <div><dt>Expense date</dt><dd>{selectedExpense.expenseDate}</dd></div>
                <div><dt>Recorded by</dt><dd>{selectedExpense.createdBy}</dd></div>
              </dl>
              <div className="expense-proof-actions">
                {Boolean(selectedExpense.hasReceipt) && <a className="button quiet" target="_blank" rel="noreferrer" href={`/api/admin/expense-receipts/${selectedExpense.id}`}>View Receipt Photo</a>}
                {selectedExpense.receiptUrl && <a className="button quiet" target="_blank" rel="noreferrer" href={selectedExpense.receiptUrl}>Open Receipt Link</a>}
              </div>
              <div className="expense-detail-actions">
                <button className="button quiet" onClick={() => setExpenseDialog(selectedExpense)}>Edit Expense</button>
                <button className="button danger-button" disabled={busy === selectedExpense.id} onClick={() => void deleteExpense(selectedExpense)}>{busy === selectedExpense.id ? "Deleting…" : "Delete Expense"}</button>
              </div>
            </aside>
          ) : <aside className="expense-detail expense-detail-empty"><span>Choose an expense to view its details.</span></aside>}
        </div>
      </div>

      <div className="security-note"><strong>Security checkpoint</strong><p>Change the initial administrator password before sharing the portal. New passwords are salted and hashed, and all active sessions are revoked when a password is reset.</p></div>
      {data.portalOwner && <section className="portal-danger-zone"><div><span className="card-kicker">Portal Owner only</span><h2>Test-data reset</h2><p>Clear trial activity before the committee starts entering live festival records. Login accounts and portal configuration are always preserved.</p></div><button className="button danger-button" onClick={() => setResetDialog(true)}>Clear Test Data</button></section>}
      {expenseDialog && <ExpenseDialog expense={expenseDialog === "new" ? null : expenseDialog} close={() => setExpenseDialog(null)} saved={async () => { setExpenseDialog(null); await load(); }} />}
      {resetDialog && <ResetPortalDialog close={() => setResetDialog(false)} />}
    </section>
  );
}

function ResetPortalDialog({ close }: { close: () => void }) {
  const [confirmation, setConfirmation] = useState("");
  const [removeFlatMaster, setRemoveFlatMaster] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const phrase = "RESET FESTIVAL DATA";

  async function reset() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/reset", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation, removeFlatMaster }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not clear test data.");
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not clear test data.");
      setBusy(false);
    }
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) close(); }}><div className="dialog reset-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-title"><button className="dialog-close" disabled={busy} onClick={close} aria-label="Close">×</button><span className="card-kicker">Portal Owner only</span><h2 id="reset-title">Clear all test data?</h2><p className="reset-warning">This cannot be undone. Donations, payment proofs, expenses, receipt photos, meeting minutes, cultural programmes and visit activity will be permanently removed.</p><div className="reset-preserved"><strong>Preserved</strong><span>User accounts, passwords and portal configuration</span><span>Occupied-flat master and resident names, unless selected below</span></div><label className="reset-checkbox"><input type="checkbox" checked={removeFlatMaster} onChange={(event) => setRemoveFlatMaster(event.target.checked)}/><span><strong>Also remove the occupied-flat master</strong><small>Select this only if the uploaded flat list itself is test data.</small></span></label><label>Type <strong>{phrase}</strong> to confirm<input autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={phrase}/></label>{error&&<p className="form-error" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" className="button quiet" disabled={busy} onClick={close}>Cancel</button><button type="button" className="button danger-action" disabled={busy||confirmation.trim().toUpperCase()!==phrase} onClick={()=>void reset()}>{busy?"Clearing…":"Permanently Clear Test Data"}</button></div></div></div>;
}

function ExpenseDialog({ expense, close, saved }: { expense: Expense | null; close: () => void; saved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [error, setError] = useState("");

  async function selectReceipt(file: File | null) {
    setReceipt(null); setError("");
    if (!file) return;
    setOptimizing(true);
    try { setReceipt(await optimizeImageUpload(file, "expense-receipt")); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to optimize receipt image."); }
    finally { setOptimizing(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    if (receipt) form.set("receiptImage", receipt);
    try {
      const response = await fetch(expense ? `/api/admin/expenses/${expense.id}` : "/api/admin/expenses", {
        method: expense ? "PATCH" : "POST", body: form,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not save expense.");
      await saved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save expense."); setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className="dialog expense-dialog" role="dialog" aria-modal="true" aria-labelledby="expense-title">
        <button className="dialog-close" onClick={close} aria-label="Close">×</button>
        <span className="card-kicker">Expense register</span>
        <h2 id="expense-title">{expense ? "Edit Expense" : "Record an Expense"}</h2>
        <form onSubmit={submit}>
          <label>Category<select name="category" required defaultValue={expense?.category ?? EXPENSE_CATEGORIES[0]}>{EXPENSE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label>Vendor / Payee<input name="vendor" required defaultValue={expense?.vendor ?? ""} /></label>
          <label>Description<textarea name="description" required rows={3} defaultValue={expense?.description ?? ""} /></label>
          <div className="field-grid"><label>Amount<input name="amount" required type="number" min="1" defaultValue={expense?.amount ?? ""} /></label><label>Expense Date<input name="expenseDate" required type="date" defaultValue={expense?.expenseDate ?? ""} /></label></div>
          <label className="proof-picker">Receipt Photo <span className="optional">optional</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => void selectReceipt(event.target.files?.[0] ?? null)} />
            <small>On mobile, choose Camera to photograph the receipt. Large images are compressed for private storage.</small>
            {optimizing && <strong>Optimizing image…</strong>}
            {receipt && <strong>Ready: {receipt.name} ({Math.ceil(receipt.size / 1024)} KB)</strong>}
          </label>
          {expense?.hasReceipt ? <label className="remove-receipt"><input type="checkbox" name="removeReceipt" value="true" />Remove the existing receipt photo</label> : null}
          <label>Receipt Link <span className="optional">optional</span><input name="receiptUrl" type="url" placeholder="https://drive.google.com/…" defaultValue={expense?.receiptUrl ?? ""} /></label>
          {error && <p className="form-error">{error}</p>}
          <div className="dialog-actions"><button type="button" className="button quiet" onClick={close}>Cancel</button><button className="button primary" disabled={busy || optimizing}>{optimizing ? "Optimizing…" : busy ? "Saving…" : expense ? "Save Changes" : "Save Expense"}</button></div>
        </form>
      </div>
    </div>
  );
}
