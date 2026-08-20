"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { optimizeImageUpload } from "../lib/client-image";
import { currency } from "../lib/constants";
import { EXPENSE_CATEGORIES } from "../lib/expense-categories";

type Expense = {
  id: string; category: string; vendor: string; description: string; amount: number; expenseDate: string;
  receiptUrl: string; hasReceipt: number; receiptName: string | null; status: string; createdBy: string; createdAt: string;
};
type Finance = {
  openingBalance: number; openingBalanceNote: string; updatedBy: string | null; updatedAt: string | null;
  verifiedCollections: number; pendingCollections: number; recordedExpenses: number; expenseCount: number;
  availableFunds: number; remainingFunds: number; deficit: number; canEditOpeningBalance: boolean;
};
const blankFinance: Finance = { openingBalance: 0, openingBalanceNote: "", updatedBy: null, updatedAt: null, verifiedCollections: 0, pendingCollections: 0, recordedExpenses: 0, expenseCount: 0, availableFunds: 0, remainingFunds: 0, deficit: 0, canEditOpeningBalance: false };

export function ExpensesDashboard() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [finance, setFinance] = useState<Finance>(blankFinance);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Expense | null>(null);
  const [expenseDialog, setExpenseDialog] = useState<Expense | "new" | null>(null);
  const [openingDialog, setOpeningDialog] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [expenseResponse, financeResponse] = await Promise.all([
      fetch("/api/admin/expenses", { cache: "no-store" }),
      fetch("/api/admin/finance-summary", { cache: "no-store" }),
    ]);
    const [expensePayload, financePayload] = await Promise.all([expenseResponse.json(), financeResponse.json()]);
    if (!expenseResponse.ok) throw new Error(expensePayload.error ?? "Unable to load expenses.");
    if (!financeResponse.ok) throw new Error(financePayload.error ?? "Unable to load the fund position.");
    setExpenses(expensePayload.expenses ?? []);
    setFinance(financePayload);
    setSelected((current) => current ? expensePayload.expenses.find((expense: Expense) => expense.id === current.id) ?? null : null);
    setError("");
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load festival expenses."));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const visible = useMemo(() => expenses.filter((expense) => `${expense.category} ${expense.vendor} ${expense.description} ${expense.expenseDate}`.toLowerCase().includes(filter.trim().toLowerCase())), [expenses, filter]);
  const categories = useMemo(() => {
    const totals = new Map<string, number>();
    for (const expense of expenses) totals.set(expense.category, (totals.get(expense.category) ?? 0) + Number(expense.amount));
    return [...totals.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  }, [expenses]);
  const maximumCategory = Math.max(1, ...categories.map((category) => category.amount));

  async function deleteExpense(expense: Expense) {
    if (!window.confirm(`Move the ${expense.category} expense of ${currency(Number(expense.amount))} to the Recycle Bin? The Portal Admin can restore it.`)) return;
    setBusy(expense.id); setError("");
    try {
      const response = await fetch(`/api/admin/expenses/${expense.id}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not move the expense to the Recycle Bin.");
      setSelected(null); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not move the expense to the Recycle Bin."); }
    finally { setBusy(""); }
  }

  return <section className="wrap expenses-shell">
    <div className="admin-heading expense-page-heading"><div><div className="eyebrow"><span />Transparent accounts</div><h1>Festival Expenses</h1><p>Record every expense, retain its receipt and monitor the live fund position.</p></div><button className="button primary" onClick={() => setExpenseDialog("new")}>+ Record Expense</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}

    <div className="finance-metrics">
      <FinanceMetric label="Opening balance" value={finance.openingBalance} note="carried forward from last year" />
      <FinanceMetric label="Verified collections" value={finance.verifiedCollections} note="available for spending" />
      <FinanceMetric label="Total funds available" value={finance.availableFunds} note="opening balance + verified collections" featured />
      <FinanceMetric label="Recorded expenses" value={finance.recordedExpenses} note={`${finance.expenseCount} active expense record${finance.expenseCount === 1 ? "" : "s"}`} />
      <FinanceMetric label={finance.deficit > 0 ? "Current deficit" : "Funds remaining"} value={finance.deficit > 0 ? finance.deficit : finance.remainingFunds} note={finance.deficit > 0 ? "expenses exceed available funds" : "after recorded expenses"} state={finance.deficit > 0 ? "deficit" : "remaining"} />
      <FinanceMetric label="Pending verification" value={finance.pendingCollections} note="not counted as available funds" />
    </div>

    <section className="fund-equation" aria-label="Fund position calculation"><div><span>Opening balance</span><strong>{currency(finance.openingBalance)}</strong></div><b>+</b><div><span>Verified collections</span><strong>{currency(finance.verifiedCollections)}</strong></div><b>−</b><div><span>Recorded expenses</span><strong>{currency(finance.recordedExpenses)}</strong></div><b>=</b><div className={finance.deficit > 0 ? "deficit" : "remaining"}><span>{finance.deficit > 0 ? "Deficit" : "Balance"}</span><strong>{currency(finance.deficit > 0 ? finance.deficit : finance.remainingFunds)}</strong></div></section>

    <section className="opening-balance-card"><div><span className="card-kicker">Previous-year carry forward</span><h2>{currency(finance.openingBalance)}</h2><p>{finance.openingBalanceNote || "No carry-forward note has been recorded."}</p>{finance.updatedAt && <small>Last updated by {finance.updatedBy ?? "Portal Admin"} · {new Date(`${finance.updatedAt}Z`).toLocaleString("en-IN")}</small>}</div>{finance.canEditOpeningBalance ? <button className="button quiet" onClick={() => setOpeningDialog(true)}>Edit Opening Balance</button> : <span className="managed-note">Managed by Portal Admin</span>}</section>

    <section className="expense-category-card"><header><div><span className="card-kicker">Quick report</span><h2>Expenses by Category</h2></div><strong>{currency(finance.recordedExpenses)}</strong></header>{categories.length ? <div className="expense-category-bars">{categories.map((item) => <div key={item.category}><span>{item.category}</span><i><b style={{ width: `${(item.amount / maximumCategory) * 100}%` }} /></i><strong>{currency(item.amount)}</strong></div>)}</div> : <div className="empty-state"><p>No expenses have been recorded yet.</p></div>}</section>

    <section className="admin-card expense-register"><header><div><span className="card-kicker">Expense register</span><h2>Recorded Expenses</h2></div><input aria-label="Search expenses" placeholder="Search category, vendor, description or date" value={filter} onChange={(event) => setFilter(event.target.value)} /></header><div className="expense-records"><div className="expense-record-list">{visible.map((expense) => <button key={expense.id} className={selected?.id === expense.id ? "selected" : ""} onClick={() => setSelected(expense)}><span><strong>{expense.category}</strong><small>{expense.vendor} · {expense.expenseDate}</small></span><span><strong>{currency(Number(expense.amount))}</strong><small>{expense.hasReceipt ? "Receipt attached" : "No receipt image"}</small></span></button>)}{!visible.length && <div className="empty-state"><span>◎</span><p>No matching expenses.</p></div>}</div>{selected ? <aside className="expense-detail"><button className="dialog-close" onClick={() => setSelected(null)} aria-label="Close expense details">×</button><span className="card-kicker">Expense details</span><h3>{selected.category}</h3><p>{selected.description}</p><dl><div><dt>Vendor / Payee</dt><dd>{selected.vendor}</dd></div><div><dt>Amount</dt><dd>{currency(Number(selected.amount))}</dd></div><div><dt>Expense date</dt><dd>{selected.expenseDate}</dd></div><div><dt>Recorded by</dt><dd>{selected.createdBy}</dd></div></dl><div className="expense-proof-actions">{Boolean(selected.hasReceipt) && <a className="button quiet" target="_blank" rel="noreferrer" href={`/api/admin/expense-receipts/${selected.id}`}>View Receipt Photo</a>}{selected.receiptUrl && <a className="button quiet" target="_blank" rel="noreferrer" href={selected.receiptUrl}>Open Receipt Link</a>}</div><div className="expense-detail-actions"><button className="button quiet" onClick={() => setExpenseDialog(selected)}>Edit Expense</button><button className="button danger-button" disabled={busy === selected.id} onClick={() => void deleteExpense(selected)}>{busy === selected.id ? "Moving…" : "Move to Recycle Bin"}</button></div></aside> : <aside className="expense-detail expense-detail-empty"><span>Choose an expense to view its details.</span></aside>}</div></section>

    {expenseDialog && <ExpenseDialog expense={expenseDialog === "new" ? null : expenseDialog} close={() => setExpenseDialog(null)} saved={async () => { setExpenseDialog(null); await load(); }} />}
    {openingDialog && <OpeningBalanceDialog finance={finance} close={() => setOpeningDialog(false)} saved={async () => { setOpeningDialog(false); await load(); }} />}
  </section>;
}

function FinanceMetric({ label, value, note, featured = false, state = "" }: { label: string; value: number; note: string; featured?: boolean; state?: string }) {
  return <article className={`${featured ? "featured " : ""}${state}`.trim()}><span>{label}</span><strong>{currency(value)}</strong><small>{note}</small></article>;
}

function OpeningBalanceDialog({ finance, close, saved }: { finance: Finance; close: () => void; saved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget); try { const response = await fetch("/api/admin/finance-summary", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ openingBalance: form.get("openingBalance"), openingBalanceNote: form.get("openingBalanceNote") }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Could not update the opening balance."); await saved(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update the opening balance."); setBusy(false); } }
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) close(); }}><div className="dialog opening-balance-dialog" role="dialog" aria-modal="true" aria-labelledby="opening-balance-title"><button className="dialog-close" disabled={busy} onClick={close} aria-label="Close">×</button><span className="card-kicker">Portal Admin control</span><h2 id="opening-balance-title">Previous-Year Carry Forward</h2><p>This amount becomes part of the funds available for Ganesh Chaturthi 2026. Changes are audit logged.</p><form onSubmit={submit}><label>Opening Balance<input name="openingBalance" type="number" min="0" max="10000000" required defaultValue={finance.openingBalance} /></label><label>Carry-Forward Note<textarea name="openingBalanceNote" rows={4} maxLength={300} defaultValue={finance.openingBalanceNote} placeholder="For example: Closing balance from Ganesh Chaturthi 2025, approved by the festival committee." /></label>{error && <p className="form-error">{error}</p>}<div className="dialog-actions"><button type="button" className="button quiet" disabled={busy} onClick={close}>Cancel</button><button className="button primary" disabled={busy}>{busy ? "Saving…" : "Save Opening Balance"}</button></div></form></div></div>;
}

function ExpenseDialog({ expense, close, saved }: { expense: Expense | null; close: () => void; saved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [optimizing, setOptimizing] = useState(false); const [receipt, setReceipt] = useState<File | null>(null); const [error, setError] = useState("");
  async function selectReceipt(file: File | null) { setReceipt(null); setError(""); if (!file) return; setOptimizing(true); try { setReceipt(await optimizeImageUpload(file, "expense-receipt")); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to optimize receipt image."); } finally { setOptimizing(false); } }
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget); if (receipt) form.set("receiptImage", receipt); try { const response = await fetch(expense ? `/api/admin/expenses/${expense.id}` : "/api/admin/expenses", { method: expense ? "PATCH" : "POST", body: form }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Could not save expense."); await saved(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save expense."); setBusy(false); } }
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) close(); }}><div className="dialog expense-dialog" role="dialog" aria-modal="true" aria-labelledby="expense-title"><button className="dialog-close" disabled={busy} onClick={close} aria-label="Close">×</button><span className="card-kicker">Expense register</span><h2 id="expense-title">{expense ? "Edit Expense" : "Record an Expense"}</h2><form onSubmit={submit}><label>Category<select name="category" required defaultValue={expense?.category ?? EXPENSE_CATEGORIES[0]}>{EXPENSE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><label>Vendor / Payee<input name="vendor" required defaultValue={expense?.vendor ?? ""} /></label><label>Description<textarea name="description" required rows={3} defaultValue={expense?.description ?? ""} /></label><div className="field-grid"><label>Amount<input name="amount" required type="number" min="1" defaultValue={expense?.amount ?? ""} /></label><label>Expense Date<input name="expenseDate" required type="date" defaultValue={expense?.expenseDate ?? ""} /></label></div><label className="proof-picker">Receipt Photo <span className="optional">optional</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void selectReceipt(event.target.files?.[0] ?? null)} /><small>On mobile, choose Camera or Photo Library. Large images are compressed for private storage.</small>{optimizing && <strong>Optimizing image…</strong>}{receipt && <strong>Ready: {receipt.name} ({Math.ceil(receipt.size / 1024)} KB)</strong>}</label>{expense?.hasReceipt ? <label className="remove-receipt"><input type="checkbox" name="removeReceipt" value="true" />Remove the existing receipt photo</label> : null}<label>Receipt Link <span className="optional">optional</span><input name="receiptUrl" type="url" placeholder="https://drive.google.com/…" defaultValue={expense?.receiptUrl ?? ""} /></label>{error && <p className="form-error">{error}</p>}<div className="dialog-actions"><button type="button" className="button quiet" disabled={busy} onClick={close}>Cancel</button><button className="button primary" disabled={busy || optimizing}>{optimizing ? "Optimizing…" : busy ? "Saving…" : expense ? "Save Changes" : "Save Expense"}</button></div></form></div></div>;
}
