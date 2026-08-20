"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { currency } from "../lib/constants";

type Registration = {
  id: string; referenceNo: string; residentName: string; blockNo: string; flatNo: string;
  adultCount: number; childCount: number; status: string; amount: number; paymentStatus: string;
  paymentMethod: string; paymentReference: string; createdAt: string; hasProof: number; correctionReason: string;
};
type RecycleItem={id:string;entityType:"expense"|"meeting"|"registration";entityId:string;entityLabel:string;deletedBy:string;deletedAt:string;ageDays:number};
type Dashboard = { registrations: Registration[]; totals: { verified: number; pending: number; submissions: number }; portalOwner: boolean };
const blank: Dashboard = { registrations: [], totals: { verified: 0, pending: 0, submissions: 0 }, portalOwner: false };

export function AdminDashboard() {
  const [data, setData] = useState<Dashboard>(blank);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [correctionTarget, setCorrectionTarget] = useState<Registration | null>(null);
  const [recycleItems,setRecycleItems]=useState<RecycleItem[]>([]);

  const loadRecycle=useCallback(async()=>{const response=await fetch("/api/admin/recycle-bin",{cache:"no-store"});const payload=await response.json();if(!response.ok)throw new Error(payload.error??"Unable to load the Recycle Bin.");setRecycleItems(payload.items??[]);},[]);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/dashboard");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Unable to load festival accounts.");
    setData(payload);
    if(payload.portalOwner)await loadRecycle();else setRecycleItems([]);
  }, [loadRecycle]);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/dashboard")
      .then(async (response) => ({ response, payload: await response.json() }))
      .then(({ response, payload }) => {
        if (!active) return;
        if (!response.ok) setError(payload.error ?? "Unable to load festival accounts.");
        else {
          setData(payload);
          if(payload.portalOwner)void loadRecycle().catch(()=>active&&setError("Unable to load the Recycle Bin."));
        }
      })
      .catch(() => active && setError("Unable to load."));
    return () => { active = false; };
  }, [loadRecycle]);
  useEffect(()=>{if(data.portalOwner&&window.location.hash==="#recycle-bin")requestAnimationFrame(()=>document.getElementById("recycle-bin")?.scrollIntoView({behavior:"smooth"}));},[data.portalOwner]);

  const visible = useMemo(
    () => data.registrations.filter((item) => `${item.residentName} ${item.blockNo} ${item.flatNo} ${item.referenceNo}`.toLowerCase().includes(filter.toLowerCase())),
    [data.registrations, filter],
  );

  async function updateRegistration(registrationId: string, action: "verify" | "request_correction", reason = "") {
    setBusy(registrationId); setError("");
    try {
      const response = await fetch("/api/admin/donations", {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ registrationId, action, reason }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Update failed.");
      await load();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Update failed.");
      return false;
    } finally {
      setBusy("");
    }
  }

  async function restoreRecycleItem(item:RecycleItem){setBusy(item.id);setError("");try{const response=await fetch("/api/admin/recycle-bin",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:item.id})});const payload=await response.json();if(!response.ok)throw new Error(payload.error??"Could not restore the record.");await load();}catch(caught){setError(caught instanceof Error?caught.message:"Could not restore the record.");}finally{setBusy("");}}
  async function permanentlyDeleteRecycleItem(item:RecycleItem){const phrase=`DELETE ${item.entityLabel}`;const confirmation=window.prompt(`Permanent deletion cannot be undone. Type exactly:\n\n${phrase}`);if(confirmation===null)return;setBusy(item.id);setError("");try{const response=await fetch("/api/admin/recycle-bin",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({id:item.id,confirmation})});const payload=await response.json();if(!response.ok)throw new Error(payload.error??"Could not permanently delete the record.");await loadRecycle();}catch(caught){setError(caught instanceof Error?caught.message:"Could not permanently delete the record.");}finally{setBusy("");}}

  return (
    <section className="wrap admin-shell">
      <div className="admin-heading">
        <div><div className="eyebrow"><span />{data.portalOwner ? "Portal Admin" : "Administrator"}</div><h1>Collection Verification</h1><p>Review household submissions, payment proofs and verified festival collections.</p></div>
        <div className="admin-heading-actions"><a className="button primary" href="/expenses">Open Expense Workspace</a></div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="admin-metrics">
        <article><span>Verified collections</span><strong>{currency(Number(data.totals.verified))}</strong></article>
        <article><span>Pending verification</span><strong>{currency(Number(data.totals.pending))}</strong></article>
        <article><span>Household submissions</span><strong>{data.totals.submissions}</strong></article>
      </div>

      <div className="admin-card">
        <header><div><span className="card-kicker">Collection queue</span><h2>Household submissions</h2></div><input aria-label="Search submissions" placeholder="Search name, block, flat or reference" value={filter} onChange={(event) => setFilter(event.target.value)} /></header>
        <div className="table-wrap"><table><thead><tr><th>Resident</th><th>Location</th><th>Contribution</th><th>Payment</th><th>Status</th><th>Action</th></tr></thead><tbody>{visible.map((item) => <tr key={item.id}><td><strong>{item.residentName}</strong><small>{item.referenceNo}</small>{item.status==="correction_requested"&&item.correctionReason&&<small className="correction-note">Correction: {item.correctionReason}</small>}</td><td>Block {item.blockNo} · {item.flatNo}<small>{item.adultCount + item.childCount} attendees</small></td><td><strong>{currency(Number(item.amount))}</strong></td><td>{item.paymentMethod?.replace("_", " ")}<small>{item.paymentReference || "No reference"}</small>{item.hasProof?<a className="table-proof-link" target="_blank" rel="noreferrer" href={`/api/payment-proofs/${item.id}`}>View Payment Proof</a>:<small>No proof attached</small>}</td><td><span className={`status ${item.status}`}>{item.status.replaceAll("_", " ")}</span></td><td>{item.status === "submitted" ? <div className="row-actions"><button disabled={busy === item.id} onClick={() => updateRegistration(item.id, "verify")}>Verify Payment</button><button className="danger" disabled={busy === item.id} onClick={() => setCorrectionTarget(item)}>Request Correction</button></div> : item.status === "correction_requested"?<span className="done">Awaiting correction</span>:<span className="done">Complete</span>}</td></tr>)}</tbody></table>{visible.length === 0 && <div className="empty-state"><span>◎</span><p>No matching submissions.</p></div>}</div>
      </div>

      <div className="security-note"><strong>Security checkpoint</strong><p>Change the initial administrator password before sharing the portal. New passwords are salted and hashed, and all active sessions are revoked when a password is reset.</p></div>
      {data.portalOwner&&<section className="admin-card recycle-bin" id="recycle-bin"><header><div><span className="card-kicker">Portal Admin recovery</span><h2>Recycle Bin</h2><p>Restore accidentally removed records. Permanent deletion is locked for 30 days and requires typed confirmation.</p></div><span className="recycle-count">{recycleItems.length} item{recycleItems.length===1?"":"s"}</span></header>{recycleItems.length?<div className="recycle-list">{recycleItems.map((item)=><article key={item.id}><div><span className="status recycled">{item.entityType}</span><strong>{item.entityLabel}</strong><small>Removed by {item.deletedBy} · {new Date(item.deletedAt+"Z").toLocaleString("en-IN")}</small></div><div className="recycle-actions"><button className="button quiet" disabled={busy===item.id} onClick={()=>void restoreRecycleItem(item)}>Restore</button><button className="button danger-button" disabled={busy===item.id||Number(item.ageDays)<30} title={Number(item.ageDays)<30?`Available in ${30-Number(item.ageDays)} day(s)`:"Permanently delete"} onClick={()=>void permanentlyDeleteRecycleItem(item)}>{Number(item.ageDays)<30?`Delete in ${30-Number(item.ageDays)}d`:"Permanently Delete"}</button></div></article>)}</div>:<div className="empty-state"><p>The Recycle Bin is empty.</p></div>}</section>}
      {correctionTarget && <CorrectionDialog registration={correctionTarget} close={() => setCorrectionTarget(null)} submit={async (reason) => { const saved=await updateRegistration(correctionTarget.id,"request_correction",reason); if(saved)setCorrectionTarget(null); return saved; }} />}
    </section>
  );
}

function CorrectionDialog({registration,close,submit}:{registration:Registration;close:()=>void;submit:(reason:string)=>Promise<boolean>}) {
  const [reason,setReason]=useState(""); const [busy,setBusy]=useState(false);
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event)=>{if(!busy&&event.target===event.currentTarget)close();}}><div className="dialog correction-dialog" role="dialog" aria-modal="true" aria-labelledby="correction-title"><button className="dialog-close" disabled={busy} onClick={close} aria-label="Close">×</button><span className="card-kicker">Payment verification</span><h2 id="correction-title">Request a correction</h2><p>Tell the Block {registration.blockNo} Coordinator exactly what needs to be corrected for Flat {registration.flatNo}.</p><label>Correction required<textarea rows={4} maxLength={300} required autoFocus value={reason} onChange={(event)=>setReason(event.target.value)} placeholder="For example: payment screenshot is unclear; please upload a clearer image."/></label><div className="dialog-actions"><button type="button" className="button quiet" disabled={busy} onClick={close}>Cancel</button><button type="button" className="button primary" disabled={busy||!reason.trim()} onClick={()=>{setBusy(true);void submit(reason.trim()).then((saved)=>{if(!saved)setBusy(false);}).catch(()=>setBusy(false));}}>{busy?"Requesting…":"Request Correction"}</button></div></div></div>;
}
