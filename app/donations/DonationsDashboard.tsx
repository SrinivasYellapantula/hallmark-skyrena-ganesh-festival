"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { currency } from "../lib/constants";
import { optimizeImageUpload } from "../lib/client-image";

type Row = {
  id: string; referenceNo: string; residentName: string; blockNo: string; flatNo: string;
  donorType: "resident" | "vendor"; vendorCategory: string; contactPerson: string; vendorAddress: string;
  gotram: string; occupancy: string; phone: string | null; amount: number;
  festivalAmount: number; idolAmount: number; laddooAmount: number; annadaanamAmount: number; status: string; paymentReference: string;
  createdAt: string; hasProof: number; paymentCount: number; adultCount: number; childCount: number; notes: string;
  correctionReason: string; duplicateReviewOutcome: string; duplicateReviewNote: string; inOccupiedMaster: number;
};
type User = { role: "admin" | "block"; blockNo: string | null };
type AttendanceFilter = "all" | "zero" | "attending";
type ReviewFilter = "all" | "duplicates";
type DuplicateInfo = { count: number; reason: string; references: string[]; outcome: string; note: string };

export function DonationsDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [query, setQuery] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>("all");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [selected, setSelected] = useState<Row | null>(null);
  const [replacementProof, setReplacementProof] = useState<File | null>(null);
  const [additionalProof, setAdditionalProof] = useState<File | null>(null);
  const [optimizingProof, setOptimizingProof] = useState(false);
  const [addingPayment, setAddingPayment] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [masterBusy, setMasterBusy] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/donations");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setRows(payload.donations);
      setSelected((current) => current ? payload.donations.find((row: Row) => row.id === current.id) ?? null : null);
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

  const zeroAttendanceCount = useMemo(
    () => rows.filter((row) => Number(row.adultCount) === 0 && Number(row.childCount) === 0).length,
    [rows],
  );

  const duplicateReview = useMemo(() => buildDuplicateReview(rows), [rows]);
  const duplicateFlatCount = useMemo(() => new Set(duplicateReview.values()).size, [duplicateReview]);

  const visible = useMemo(() => rows.filter((row) => {
    const matchesQuery = `${row.residentName} ${row.vendorCategory ?? ""} ${row.contactPerson ?? ""} ${row.blockNo} ${row.flatNo} ${row.referenceNo} ${row.phone ?? ""}`
      .toLowerCase().includes(query.trim().toLowerCase());
    const totalAttendees = Number(row.adultCount) + Number(row.childCount);
    const matchesAttendance = attendanceFilter === "all"
      || (attendanceFilter === "zero" && totalAttendees === 0)
      || (attendanceFilter === "attending" && totalAttendees > 0);
    const matchesReview = reviewFilter === "all" || duplicateReview.has(row.id);
    return matchesQuery && matchesAttendance && matchesReview;
  }), [attendanceFilter, duplicateReview, query, reviewFilter, rows]);

  const selectedDuplicate = selected ? duplicateReview.get(selected.id) : undefined;

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

  async function selectAdditionalProof(file: File | null) {
    setAdditionalProof(null); setError("");
    if (!file) return;
    setOptimizingProof(true);
    try { setAdditionalProof(await optimizeImageUpload(file, "payment-proof")); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to prepare payment proof."); }
    finally { setOptimizingProof(false); }
  }

  async function addPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected || !additionalProof) { setError("Upload the confirmation image for this payment."); return; }
    setAddingPayment(true); setError(""); setPaymentMessage("");
    const form=new FormData(event.currentTarget); form.set("paymentProof",additionalProof);
    try {
      const response=await fetch(`/api/donations/${selected.id}`,{method:"POST",body:form}); const payload=await response.json();
      if(!response.ok)throw new Error(payload.error??"Could not add the payment.");
      event.currentTarget.reset(); setAdditionalProof(null); setPaymentMessage(`Additional payment of ${currency(Number(payload.total))} recorded and sent for verification.`); await load();
    } catch(caught) { setError(caught instanceof Error?caught.message:"Could not add the payment."); }
    finally { setAddingPayment(false); }
  }

  async function archiveDonation(row:Row) {
    if(!window.confirm(`Move ${row.referenceNo} for ${row.residentName} to the Recycle Bin? The Portal Admin can restore it.`))return;
    setError("");
    const response=await fetch(`/api/donations/${row.id}`,{method:"DELETE"});
    const payload=await response.json();
    if(!response.ok){setError(payload.error??"Could not move the donation to the Recycle Bin.");return;}
    setSelected(null);setReplacementProof(null);await load();
  }

  async function addToOccupiedMaster(row: Row) {
    if (row.donorType === "vendor") return;
    if (!window.confirm(`Add Block ${row.blockNo} Flat ${row.flatNo} to the occupied-flat master? This will include it in occupied-flat coverage and pending calculations.`)) return;
    setMasterBusy(true); setError("");
    try {
      const response = await fetch("/api/flats", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ blockNo: row.blockNo, flatNo: row.flatNo, residentName: row.residentName, occupancy: row.occupancy }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to add the flat to the occupied-flat master.");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to add the flat to the occupied-flat master."); }
    finally { setMasterBusy(false); }
  }

  async function saveDuplicateReview(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(!selected)return; const form=new FormData(event.currentTarget);
    setReviewBusy(true); setError("");
    try {
      const response=await fetch(`/api/donations/${selected.id}/duplicate-review`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({outcome:form.get("outcome"),note:form.get("note")})});
      const payload=await response.json(); if(!response.ok)throw new Error(payload.error??"Could not save the review outcome."); await load();
    } catch(caught) { setError(caught instanceof Error?caught.message:"Could not save the review outcome."); }
    finally { setReviewBusy(false); }
  }

  return (
    <section className={`wrap records-shell${selected ? "" : " records-shell-wide"}`}>
      {error && <p className="form-error">{error}</p>}
      <div className="admin-card donation-records-card">
        <header>
          <div><span className="card-kicker">List view</span><h2>Recorded donations</h2></div>
          <div className="donation-list-actions">
            <input aria-label="Search donations" placeholder="Search resident, flat, phone or reference" value={query} onChange={(event) => setQuery(event.target.value)} />
            <select className="attendance-filter" aria-label="Filter by Mahaprasadam attendance" value={attendanceFilter} onChange={(event) => setAttendanceFilter(event.target.value as AttendanceFilter)}>
              <option value="all">All attendance</option>
              <option value="zero">0 attendees ({zeroAttendanceCount})</option>
              <option value="attending">1 or more attendees</option>
            </select>
            <select className="duplicate-filter" aria-label="Filter donations requiring duplicate review" value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value as ReviewFilter)}>
              <option value="all">All records</option>
              <option value="duplicates">Duplicate Review ({duplicateFlatCount} flats)</option>
            </select>
            {/* This endpoint returns a file rather than a navigable application page. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a className="button quiet donation-export" href="/api/donations/export">Export Donated Flats (.xlsx)</a>
          </div>
        </header>
        <div className="record-list">
          {visible.map((row) => (
            <button key={row.id} onClick={() => { setSelected(row); setReplacementProof(null); setAdditionalProof(null); setPaymentMessage(""); }}>
              <span><strong>{row.residentName}</strong><small>{row.donorType === "vendor" ? `Outside Vendor · ${titleCase(row.vendorCategory)} · recorded by Block ${row.blockNo} team` : `Block ${row.blockNo} · Flat ${row.flatNo}`} · {row.referenceNo}</small>{duplicateReview.has(row.id)&&<small className="duplicate-review-label">Duplicate Review · {duplicateReview.get(row.id)?.reason}</small>}{row.donorType !== "vendor"&&<small className={row.adultCount + row.childCount === 0 ? "attendance-review" : ""}>{row.adultCount + row.childCount} Mahaprasadam attendee{row.adultCount + row.childCount === 1 ? "" : "s"}{row.adultCount + row.childCount === 0 ? " · please confirm" : ""}</small>}</span>
              <span><strong>{currency(Number(row.amount))}</strong><small className={`status ${row.status}`}>{row.status}</small></span>
            </button>
          ))}
        </div>
        {!visible.length && <div className="empty-state"><p>No matching donations.</p></div>}
      </div>

      {selected && (
        <aside className="detail-panel">
          <button className="dialog-close" onClick={() => { setSelected(null); setReplacementProof(null); setAdditionalProof(null); setPaymentMessage(""); }} aria-label="Close detailed view">×</button>
          <span className="card-kicker">Detailed view</span>
          <h2>{selected.residentName}</h2>
          <p>{selected.donorType === "vendor" ? `Outside Vendor · recorded by Block ${selected.blockNo} team` : `Block ${selected.blockNo} · Flat ${selected.flatNo}`} · {selected.referenceNo}</p>
          {selectedDuplicate&&<div className="duplicate-review-alert"><strong>Duplicate Review</strong><span>{selectedDuplicate.count} active submissions were found for this block and flat.</span><span>{selectedDuplicate.reason}.</span><small>Both donations remain in collection totals, while the flat is counted once. Review the references and proofs before deciding.</small><form key={selected.id} onSubmit={saveDuplicateReview}><label>Review outcome<select name="outcome" defaultValue={selectedDuplicate.outcome||"needs_review"}><option value="needs_review">Needs further review</option><option value="genuine_owner_tenant">Genuine — Owner and tenant donated</option><option value="genuine_separate_donations">Genuine — Separate donations</option><option value="actual_duplicate">Actual duplicate entry</option></select></label><label>Review note <span className="optional">optional</span><input name="note" maxLength={300} defaultValue={selectedDuplicate.note}/></label><button className="button quiet full" disabled={reviewBusy}>{reviewBusy?"Saving…":"Save Review Outcome"}</button></form></div>}
          {!selectedDuplicate&&selected.duplicateReviewOutcome.startsWith("genuine_")&&<p className="form-success">Duplicate review completed: {selected.duplicateReviewOutcome==="genuine_owner_tenant"?"owner and tenant both donated":"genuine separate donations"}.</p>}
          {selected.status === "correction_requested" && <div className="correction-alert"><strong>Correction requested</strong><span>{selected.correctionReason || "Please review and correct this submission."}</span><small>Saving the corrected record will send it back for administrator verification.</small></div>}
          <dl>
            <div><dt>Status</dt><dd>{selected.status}</dd></div>
            <div><dt>Donor type</dt><dd>{selected.donorType === "vendor" ? "Outside Vendor" : "Resident / Flat"}</dd></div>
            {selected.donorType === "vendor" ? <><div><dt>Vendor type</dt><dd>{titleCase(selected.vendorCategory)}</dd></div><div><dt>Contact person</dt><dd>{selected.contactPerson}</dd></div><div><dt>Location / Address</dt><dd>{selected.vendorAddress || "Not recorded"}</dd></div></> : <div><dt>Occupied-flat master</dt><dd><span className={`master-membership ${selected.inOccupiedMaster ? "included" : "outside"}`}>{selected.inOccupiedMaster ? "Included" : "Not included"}</span></dd></div>}
            <div><dt>Festival donation</dt><dd>{currency(Number(selected.festivalAmount))}</dd></div>
            <div><dt>Idol donation</dt><dd>{currency(Number(selected.idolAmount))}</dd></div>
            <div><dt>Laddoo donation</dt><dd>{currency(Number(selected.laddooAmount))}</dd></div>
            <div><dt>Mahaprasadam donation</dt><dd>{currency(Number(selected.annadaanamAmount))}</dd></div>
            <div><dt>Total</dt><dd>{currency(Number(selected.amount))}</dd></div>
            {selected.donorType !== "vendor"&&<><div><dt>Gotram</dt><dd>{selected.gotram || "Not recorded"}</dd></div><div><dt>Resident type</dt><dd>{selected.occupancy || "Not recorded"}</dd></div></>}
            <div><dt>Phone</dt><dd>{selected.phone ? <a href={`tel:+91${selected.phone}`}>+91 {selected.phone}</a> : "Not recorded"}</dd></div>
            {selected.donorType !== "vendor"&&<div><dt>Attendees</dt><dd>{selected.adultCount} adults · {selected.childCount} children</dd></div>}
            <div><dt>UPI reference</dt><dd>{selected.paymentReference || "Not recorded"}</dd></div>
          </dl>
          {selected.donorType !== "vendor"&&!selected.inOccupiedMaster && <div className="master-review"><p>This donation is included in the collection total but the flat is not counted as occupied.</p><button type="button" className="button quiet full" disabled={masterBusy} onClick={() => void addToOccupiedMaster(selected)}>{masterBusy ? "Adding…" : "Add to Occupied-Flat Master"}</button></div>}
          {selected.hasProof ? (
            <a className="button quiet full" target="_blank" rel="noreferrer" href={`/api/payment-proofs/${selected.id}`}>View payment history &amp; proofs</a>
          ) : <p className="notice">No proof attached.</p>}
          <section className="additional-payment-card">
            <span className="card-kicker">New transaction</span><h3>Add Another Payment</h3>
            <p>Use this when the same resident or vendor pays again. The earlier payment and screenshot will be retained.</p>
            {paymentMessage&&<p className="form-success">{paymentMessage}</p>}
            <form onSubmit={addPayment}>
              <div className="field-grid"><label>Main festival<input name="mainDonation" type="number" inputMode="numeric" min="0" defaultValue="0" onFocus={(event)=>event.currentTarget.select()} /></label><label>Idol<input name="idolDonation" type="number" inputMode="numeric" min="0" defaultValue="0" onFocus={(event)=>event.currentTarget.select()} /></label><label>Laddoos<input name="laddooDonation" type="number" inputMode="numeric" min="0" defaultValue="0" onFocus={(event)=>event.currentTarget.select()} /></label><label>Mahaprasadam<input name="annadaanamDonation" type="number" inputMode="numeric" min="0" defaultValue="0" onFocus={(event)=>event.currentTarget.select()} /></label></div>
              <label>Payment method<select name="paymentMethod" defaultValue="upi"><option value="upi">UPI</option><option value="imps">IMPS</option><option value="neft">NEFT</option></select></label>
              <label>Transaction reference <span className="optional">optional</span><input name="paymentReference" maxLength={80}/></label>
              <label className="proof-picker">New Payment Confirmation Image<input required type="file" accept="image/jpeg,image/png,image/webp" onChange={(event)=>void selectAdditionalProof(event.target.files?.[0]??null)}/><small>{optimizingProof?"Preparing image…":additionalProof?`Ready: ${additionalProof.name}`:"Choose a photo from the camera or gallery."}</small></label>
              <button className="button primary full" disabled={addingPayment||optimizingProof}>{addingPayment?"Adding Payment…":"Add Payment & Keep Existing Proof"}</button>
            </form>
          </section>
          <form onSubmit={save}>
            <span className="card-kicker">Record corrections</span>
            {user?.role === "admin" && selected.donorType !== "vendor" && <label>Flat number<input required name="flatNo" autoCapitalize="characters" maxLength={20} pattern={selected.blockNo === "C" ? "(?:G0?[1-6]|(?:[1-9]|1[01245])0[1-6])" : "(?:G(?:0?[1-9]|10)|(?:[1-9]|1[01245])(?:0[1-9]|10))"} title={`Enter a valid Block ${selected.blockNo} flat. ${selected.blockNo === "C" ? "Use flat sequence 01–06." : "Use flat sequence 01–10."}`} defaultValue={selected.flatNo} /><small>Administrator correction. The block remains {selected.blockNo}.</small></label>}
            {Number(selected.paymentCount)<=1?<><input type="hidden" name="editPayments" value="true"/><label>Festival amount<input name="mainDonation" type="number" min="0" defaultValue={selected.festivalAmount} /></label><label>Idol donation amount<input name="idolDonation" type="number" min="0" defaultValue={selected.idolAmount} /></label><label>Laddoo donation amount<input name="laddooDonation" type="number" min="0" defaultValue={selected.laddooAmount} /></label><label>Mahaprasadam donation amount<input name="annadaanamDonation" type="number" min="0" defaultValue={selected.annadaanamAmount} /></label><label>Transaction reference<input name="paymentReference" defaultValue={selected.paymentReference} /></label><label className="proof-picker">Replace Original Payment Proof <span className="optional">optional</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event)=>void selectReplacementProof(event.target.files?.[0]??null)}/><small>{optimizingProof?"Preparing image…":replacementProof?`Ready: ${replacementProof.name}`:"Use only to correct the original proof. Add Another Payment retains it."}</small></label></>:<p className="notice">This record has multiple payments. Their amounts and proofs are protected from bulk replacement.</p>}
            {selected.donorType !== "vendor"&&<div className="field-grid">
              <label>Adults<input name="adultCount" type="number" min="0" max="7" defaultValue={selected.adultCount} /></label>
              <label>Kids below 10<input name="childCount" type="number" min="0" max="7" defaultValue={selected.childCount} /></label>
            </div>}
            <label>Notes<textarea name="notes" defaultValue={selected.notes} /></label>
            <button className="button primary full" disabled={optimizingProof}>{selected.status === "correction_requested" ? "Save & Resubmit for Verification" : "Save Permitted Changes"}</button>
          </form>
          {user?.role==="admin"&&<button type="button" className="button danger-button full recycle-action" onClick={()=>void archiveDonation(selected)}>Move Donation to Recycle Bin</button>}
        </aside>
      )}
    </section>
  );
}

function buildDuplicateReview(rows: Row[]) {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    if (row.donorType === "vendor") continue;
    const key = `${row.blockNo.trim().toUpperCase()}:${canonicalFlatNo(row.flatNo, row.blockNo)}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const review = new Map<string, DuplicateInfo>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const reviewed=group.find((row)=>row.duplicateReviewOutcome);
    if(group.some((row)=>["genuine_owner_tenant","genuine_separate_donations"].includes(row.duplicateReviewOutcome)))continue;
    const paymentReferences = group.map((row) => normalizePaymentReference(row.paymentReference)).filter(Boolean);
    const repeatedReference = paymentReferences.find((reference, index) => paymentReferences.indexOf(reference) !== index);
    const verifiedCount = group.filter((row) => row.status === "verified").length;
    const samePhoneAndAmount = group.some((row, index) => group.some((other, otherIndex) => index !== otherIndex && row.phone && row.phone === other.phone && Number(row.amount) === Number(other.amount)));
    const reason = reviewed?.duplicateReviewOutcome==="actual_duplicate" ? "Confirmed as an actual duplicate entry"
      : repeatedReference ? "Same payment reference appears more than once"
      : verifiedCount === 1 ? "Multiple forms but only one verified payment"
      : samePhoneAndAmount ? "Same phone number and amount appear more than once"
      : "Multiple submissions exist for the same flat";
    const info = { count: group.length, reason, references: group.map((row) => row.referenceNo).sort(), outcome: reviewed?.duplicateReviewOutcome??"", note: reviewed?.duplicateReviewNote??"" };
    for (const row of group) review.set(row.id, info);
  }
  return review;
}

function canonicalFlatNo(flatNo: string, blockNo: string) {
  const flat = flatNo.trim().toUpperCase().replace(/[\s-]+/g, "");
  const block = blockNo.trim().toUpperCase();
  return flat.startsWith(block) && /^(?:G|\d)/.test(flat.slice(block.length)) ? flat.slice(block.length) : flat;
}

function normalizePaymentReference(reference: string) {
  return reference.trim().toUpperCase().replace(/[\s-]+/g, "");
}

function titleCase(value: string) {
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not recorded";
}
