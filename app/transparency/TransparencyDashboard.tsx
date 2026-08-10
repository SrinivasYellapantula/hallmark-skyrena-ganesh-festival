"use client";

import { useEffect, useMemo, useState } from "react";
import { currency } from "../lib/constants";

type Summary = {
  totals: { festival: number; idol: number; annadaanam: number; households: number; adults: number; children: number; expenses: number };
  blocks: { block: string; amount: number; households: number }[];
  donors: { name: string; block: string; amount: number; verifiedAt: string }[];
  expenses: { category: string; vendor: string; description: string; amount: number; expenseDate: string; receiptUrl: string }[];
};

const empty: Summary = { totals: { festival: 0, idol: 0, annadaanam: 0, households: 0, adults: 0, children: 0, expenses: 0 }, blocks: [], donors: [], expenses: [] };

export function TransparencyDashboard() {
  const [data, setData] = useState<Summary>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/public/summary")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Unable to load accounts.");
        setData(body);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load accounts."))
      .finally(() => setLoading(false));
  }, []);

  const collected = Number(data.totals.festival) + Number(data.totals.idol) + Number(data.totals.annadaanam);
  const balance = collected - Number(data.totals.expenses);
  const maxBlock = useMemo(() => Math.max(1, ...data.blocks.map((block) => Number(block.amount))), [data.blocks]);

  return (
    <>
      <section className="page-intro wrap transparency-intro">
        <div><div className="eyebrow"><span /> Public accounts</div><h1>Every verified rupee,<br /><em>in the open.</em></h1></div>
        <div className="freshness"><span className="live-dot" /> Live from committee-verified records<p>No private household details are shown.</p></div>
      </section>
      {error && <div className="wrap form-error" role="alert">{error}</div>}
      <section className={`wrap metrics-grid ${loading ? "is-loading" : ""}`} aria-busy={loading}>
        <article className="metric primary-metric"><span>Total collected</span><strong>{currency(collected)}</strong><small>{data.totals.households} verified households</small></article>
        <article className="metric"><span>Festival fund</span><strong>{currency(Number(data.totals.festival))}</strong><small>General celebrations</small></article>
        <article className="metric"><span>Idol fund</span><strong>{currency(Number(data.totals.idol))}</strong><small>Separate idol contributions</small></article>
        <article className="metric"><span>Mahaprasadam fund</span><strong>{currency(Number(data.totals.annadaanam))}</strong><small>{Number(data.totals.adults) + Number(data.totals.children)} attendees planned</small></article>
        <article className="metric"><span>Available balance</span><strong>{currency(balance)}</strong><small>After approved expenses</small></article>
      </section>

      <section className="wrap dashboard-grid section">
        <article className="dashboard-card block-card">
          <header><div><span className="card-kicker">Participation</span><h2>Collections by block</h2></div><small>Verified total</small></header>
          {data.blocks.length === 0 ? <Empty text="Block totals appear after the first payment is verified." /> :
            <div className="bar-list">{data.blocks.map((item) => <div className="bar-row" key={item.block}><b>Block {item.block}</b><div className="bar-track"><span style={{ width: `${(Number(item.amount) / maxBlock) * 100}%` }} /></div><strong>{currency(Number(item.amount))}</strong><small>{item.households} homes</small></div>)}</div>}
        </article>
        <article className="dashboard-card attendance-card">
          <header><div><span className="card-kicker">Lunch Mahaprasadam plan</span><h2>Expected guests</h2></div></header>
          <div className="guest-total">{Number(data.totals.adults) + Number(data.totals.children)}<span>people</span></div>
          <div className="guest-split"><div><strong>{data.totals.adults}</strong><span>Adults</span></div><div><strong>{data.totals.children}</strong><span>Kids below 10</span></div></div>
        </article>
      </section>

      <section className="wrap dashboard-grid section no-top">
        <article className="dashboard-card">
          <header><div><span className="card-kicker">With consent</span><h2>Community supporters</h2></div></header>
          {data.donors.length === 0 ? <Empty text="Consenting donor names will appear here after verification." /> : <div className="donor-list">{data.donors.map((donor, index) => <div key={`${donor.name}-${index}`}><span className="avatar">{donor.name.slice(0, 1)}</span><p><strong>{donor.name}</strong><small>Block {donor.block}</small></p><b>{currency(Number(donor.amount))}</b></div>)}</div>}
        </article>
        <article className="dashboard-card expense-card">
          <header><div><span className="card-kicker">Approved spending</span><h2>Expense register</h2></div><strong>{currency(Number(data.totals.expenses))}</strong></header>
          {data.expenses.length === 0 ? <Empty text="Approved festival expenses will be listed here." /> : <div className="expense-list">{data.expenses.map((expense, index) => <div key={`${expense.expenseDate}-${index}`}><p><strong>{expense.description}</strong><small>{expense.vendor} · {expense.category}</small></p><span>{currency(Number(expense.amount))}{expense.receiptUrl && <a href={expense.receiptUrl} target="_blank" rel="noreferrer">Receipt</a>}</span></div>)}</div>}
        </article>
      </section>
    </>
  );
}

function Empty({ text }: { text: string }) { return <div className="empty-state"><span>◎</span><p>{text}</p></div>; }
