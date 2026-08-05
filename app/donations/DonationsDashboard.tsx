"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { currency } from "../lib/constants";

type Row = {
  id: string; referenceNo: string; residentName: string; blockNo: string; flatNo: string;
  gotram: string; occupancy: string; phone: string | null; amount: number;
  festivalAmount: number; annadaanamAmount: number; status: string; paymentReference: string;
  createdAt: string; hasProof: number; adultCount: number; childCount: number; notes: string;
};

export function DonationsDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/donations");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setRows(payload.donations);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load donations.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/donations")
      .then(async (response) => ({ response, payload: await response.json() }))
      .then(({ response, payload }) => {
        if (!active) return;
        if (!response.ok) setError(payload.error);
        else setRows(payload.donations);
      })
      .catch(() => active && setError("Unable to load donations."));
    return () => { active = false; };
  }, []);

  const visible = useMemo(
    () => rows.filter((row) => `${row.residentName} ${row.blockNo} ${row.flatNo} ${row.referenceNo}`.toLowerCase().includes(query.toLowerCase())),
    [rows, query],
  );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const response = await fetch(`/api/donations/${selected.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
    });
    const payload = await response.json();
    if (!response.ok) { setError(payload.error); return; }
    setSelected(null);
    await load();
  }

  return (
    <section className="wrap records-shell">
      {error && <p className="form-error">{error}</p>}
      <div className="admin-card">
        <header>
          <div><span className="card-kicker">List view</span><h2>Recorded donations</h2></div>
          <input placeholder="Search resident, flat or reference" value={query} onChange={(event) => setQuery(event.target.value)} />
        </header>
        <div className="record-list">
          {visible.map((row) => (
            <button key={row.id} onClick={() => setSelected(row)}>
              <span><strong>{row.residentName}</strong><small>Block {row.blockNo} · Flat {row.flatNo} · {row.referenceNo}</small></span>
              <span><strong>{currency(Number(row.amount))}</strong><small className={`status ${row.status}`}>{row.status}</small></span>
            </button>
          ))}
        </div>
        {!visible.length && <div className="empty-state"><p>No matching donations.</p></div>}
      </div>

      {selected && (
        <aside className="detail-panel">
          <button className="dialog-close" onClick={() => setSelected(null)} aria-label="Close detailed view">×</button>
          <span className="card-kicker">Detailed view</span>
          <h2>{selected.residentName}</h2>
          <p>Block {selected.blockNo} · Flat {selected.flatNo} · {selected.referenceNo}</p>
          <dl>
            <div><dt>Status</dt><dd>{selected.status}</dd></div>
            <div><dt>Festival donation</dt><dd>{currency(Number(selected.festivalAmount))}</dd></div>
            <div><dt>Annadaanam donation</dt><dd>{currency(Number(selected.annadaanamAmount))}</dd></div>
            <div><dt>Total</dt><dd>{currency(Number(selected.amount))}</dd></div>
            <div><dt>Gotram</dt><dd>{selected.gotram}</dd></div>
            <div><dt>Resident type</dt><dd>{selected.occupancy}</dd></div>
            <div><dt>Phone</dt><dd>{selected.phone || "Not recorded"}</dd></div>
            <div><dt>Attendees</dt><dd>{selected.adultCount} adults · {selected.childCount} children</dd></div>
            <div><dt>UPI reference</dt><dd>{selected.paymentReference}</dd></div>
          </dl>
          {selected.hasProof ? (
            <a className="button quiet full" target="_blank" rel="noreferrer" href={`/api/payment-proofs/${selected.id}`}>View payment proof</a>
          ) : <p className="notice">No proof attached.</p>}
          <form onSubmit={save}>
            <label>Festival amount<input name="mainDonation" type="number" min="2000" defaultValue={selected.festivalAmount} /></label>
            <label>UPI reference<input name="paymentReference" defaultValue={selected.paymentReference} /></label>
            <div className="field-grid">
              <label>Adults<input name="adultCount" type="number" min="0" defaultValue={selected.adultCount} /></label>
              <label>Children<input name="childCount" type="number" min="0" defaultValue={selected.childCount} /></label>
            </div>
            <label>Notes<textarea name="notes" defaultValue={selected.notes} /></label>
            <button className="button primary full">Save permitted changes</button>
          </form>
        </aside>
      )}
    </section>
  );
}
