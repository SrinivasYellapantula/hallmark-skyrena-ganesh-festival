"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { currency } from "../lib/constants";
import { optimizeImageUpload } from "../lib/client-image";

type Row = {
  id: string; referenceNo: string; residentName: string; blockNo: string; flatNo: string;
  gotram: string; occupancy: string; phone: string | null; amount: number;
  festivalAmount: number; idolAmount: number; annadaanamAmount: number; status: string; paymentReference: string;
  createdAt: string; hasProof: number; adultCount: number; childCount: number; notes: string;
  correctionReason: string;
};
type User = { role: "admin" | "block"; blockNo: string | null };

export function DonationsDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [replacementProof, setReplacementProof] = useState<File | null>(null);
  const [optimizingProof, setOptimizingProof] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/donations");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setRows(payload.donations);
      setUser(payload.user);
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
        else { setRows(payload.donations); setUser(payload.user); }
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
    const form = new FormData(event.currentTarget);
    if (replacementProof) form.set("paymentProof", replacementProof);
    const response = await fetch(`/api/donations/${selected.id}`, {
      method: "PATCH", body: form,
    });
    const payload = await response.json();
    if (!response.ok) { setError(payload.error); return; }
    setSelected(null); setReplacementProof(null);
    await load();
  }

  async function selectReplacementProof(file: File | null) {
    setReplacementProof(null); setError("");
    if (!file) return;
    setOptimizingProof(true);
    try { setReplacementProof(await optimizeImageUpload(file, "payment-proof")); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to prepare payment proof."); }
    finally { setOptimizingProof(false); }
  }

  async function archiveDonation(row:Row) {
    if(!window.confirm(`Move ${row.referenceNo} for ${row.residentName} to the Recycle Bin? The Portal Admin can restore it.`))return;
    setError("");
    const response=await fetch(`/api/donations/${row.id}`,{method:"DELETE"});
    const payload=await response.json();
    if(!response.ok){setError(payload.error??"Could not move the donation to the Recycle Bin.");return;}
    setSelected(null);setReplacementProof(null);await load();
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
            <button key={row.id} onClick={() => { setSelected(row); setReplacementProof(null); }}>
              <span><strong>{row.residentName}</strong><small>Block {row.blockNo} · Flat {row.flatNo} · {row.referenceNo}</small></span>
              <span><strong>{currency(Number(row.amount))}</strong><small className={`status ${row.status}`}>{row.status}</small></span>
            </button>
          ))}
        </div>
        {!visible.length && <div className="empty-state"><p>No matching donations.</p></div>}
      </div>

      {selected && (
        <aside className="detail-panel">
          <button className="dialog-close" onClick={() => { setSelected(null); setReplacementProof(null); }} aria-label="Close detailed view">×</button>
          <span className="card-kicker">Detailed view</span>
          <h2>{selected.residentName}</h2>
          <p>Block {selected.blockNo} · Flat {selected.flatNo} · {selected.referenceNo}</p>
          {selected.status === "correction_requested" && <div className="correction-alert"><strong>Correction requested</strong><span>{selected.correctionReason || "Please review and correct this submission."}</span><small>Saving the corrected record will send it back for administrator verification.</small></div>}
          <dl>
            <div><dt>Status</dt><dd>{selected.status}</dd></div>
            <div><dt>Festival donation</dt><dd>{currency(Number(selected.festivalAmount))}</dd></div>
            <div><dt>Idol donation</dt><dd>{currency(Number(selected.idolAmount))}</dd></div>
            <div><dt>Mahaprasadam donation</dt><dd>{currency(Number(selected.annadaanamAmount))}</dd></div>
            <div><dt>Total</dt><dd>{currency(Number(selected.amount))}</dd></div>
            <div><dt>Gotram</dt><dd>{selected.gotram}</dd></div>
            <div><dt>Resident type</dt><dd>{selected.occupancy}</dd></div>
            <div><dt>Phone</dt><dd>{selected.phone || "Not recorded"}</dd></div>
            <div><dt>Attendees</dt><dd>{selected.adultCount} adults · {selected.childCount} children</dd></div>
            <div><dt>UPI reference</dt><dd>{selected.paymentReference || "Not recorded"}</dd></div>
          </dl>
          {selected.hasProof ? (
            <a className="button quiet full" target="_blank" rel="noreferrer" href={`/api/payment-proofs/${selected.id}`}>View payment proof</a>
          ) : <p className="notice">No proof attached.</p>}
          <form onSubmit={save}>
            <label>Festival amount<input name="mainDonation" type="number" min="2000" defaultValue={selected.festivalAmount} /></label>
            <label>Idol donation amount<input name="idolDonation" type="number" min="0" defaultValue={selected.idolAmount} /></label>
            <label>Mahaprasadam donation amount<input name="annadaanamDonation" type="number" min="0" defaultValue={selected.annadaanamAmount} /></label>
            <label>UPI reference<input name="paymentReference" defaultValue={selected.paymentReference} /></label>
            <label className="proof-picker">Replace Payment Proof <span className="optional">optional</span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event)=>void selectReplacementProof(event.target.files?.[0]??null)}/><small>{optimizingProof?"Preparing image…":replacementProof?`Ready: ${replacementProof.name}`:"Leave empty to keep the current payment proof."}</small></label>
            <div className="field-grid">
              <label>Adults<input name="adultCount" type="number" min="0" max="7" defaultValue={selected.adultCount} /></label>
              <label>Kids below 10<input name="childCount" type="number" min="0" max="7" defaultValue={selected.childCount} /></label>
            </div>
            <label>Notes<textarea name="notes" defaultValue={selected.notes} /></label>
            <button className="button primary full" disabled={optimizingProof}>{selected.status === "correction_requested" ? "Save & Resubmit for Verification" : "Save Permitted Changes"}</button>
          </form>
          {user?.role==="admin"&&<button type="button" className="button danger-button full recycle-action" onClick={()=>void archiveDonation(selected)}>Move Donation to Recycle Bin</button>}
        </aside>
      )}
    </section>
  );
}
