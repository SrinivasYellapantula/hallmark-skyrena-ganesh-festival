"use client";

import { FormEvent, useMemo, useState } from "react";
import { BLOCKS } from "../lib/constants";
import { eligiblePrasadamDays, prasadamDateLabel, PRASADAM_SEVA_DAYS } from "../lib/prasadam";

type FormState = { blockNo:string; flatNo:string; residentName:string; phone:string; offeringDate:string; prasadamName:string; portions:string; notes:string };
const INITIAL:FormState={blockNo:"",flatNo:"",residentName:"",phone:"",offeringDate:"",prasadamName:"",portions:"",notes:""};

export function PrasadamSevaForm(){
  const [form,setForm]=useState<FormState>(INITIAL);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [reference,setReference]=useState("");
  const dates=useMemo(()=>eligiblePrasadamDays(form.blockNo),[form.blockNo]);
  function update(name:keyof FormState,value:string){setForm((current)=>({...current,[name]:value,...(name==="blockNo"?{offeringDate:""}:null)}));}
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError("");try{const response=await fetch("/api/prasadam-offerings",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...form,flatNo:form.flatNo.toUpperCase()})});const payload=await response.json() as {error?:string;referenceNo?:string};if(!response.ok)throw new Error(payload.error??"Unable to save the offering.");setReference(payload.referenceNo??"");window.scrollTo({top:0,behavior:"smooth"});}catch(caught){setError(caught instanceof Error?caught.message:"Unable to save the offering.");}finally{setBusy(false);}}
  function another(){setReference("");setError("");setForm((current)=>({...current,offeringDate:"",prasadamName:"",portions:"",notes:""}));}

  if(reference)return <section className="wrap prasadam-success"><div className="cultural-success"><span aria-hidden="true">✓</span><p className="card-kicker">Offering registered</p><h1>Thank you for your Prasadam Seva</h1><p>Your offering has been recorded. The pooja team may contact you to coordinate preparation and handover.</p><div><small>Reference number</small><strong>{reference}</strong></div><button className="button primary" onClick={another}>Register Another Offering</button></div></section>;

  return <>
    <section className="page-intro wrap prasadam-intro"><div><div className="eyebrow"><span/>14–20 September 2026</div><h1>Daily Prasadam Seva</h1><p>Residents may voluntarily offer prasadam for the evening pooja. Choose your block to see the dates assigned to you.</p></div><aside><strong>One offering per entry</strong><span>You may submit this form again for another prasadam or eligible date.</span></aside></section>
    <section className="wrap seva-schedule" aria-label="Seven-day prasadam schedule">
      {PRASADAM_SEVA_DAYS.map((day)=><article key={day.day}><b>Day {day.day}</b><span>{prasadamDateLabel(day.date)}</span><strong>{day.block==="OPEN"?"All Blocks":`Block ${day.block}`}</strong></article>)}
      <article className="annadanam-day"><b>Day 7</b><span>{prasadamDateLabel("2026-09-20")}</span><strong>Annadanam / Annaprasadam</strong></article>
    </section>
    <section className="wrap prasadam-form-shell"><form className="prasadam-seva-form" onSubmit={submit}>
      <div className="prasadam-form-note"><strong>How date selection works</strong><p>Each block has one assigned seva day. Every block may also offer on Day 6, the open-offering day. Day 7 is reserved for the community Annadanam programme.</p></div>
      <fieldset><div className="prasadam-section-heading"><span>1</span><h2>Household Details</h2></div><div className="field-grid">
        <label><span className="prasadam-field-label">Block <b>*</b></span><select required value={form.blockNo} onChange={(event)=>update("blockNo",event.target.value)}><option value="" disabled>Select block</option>{BLOCKS.map((block)=><option key={block} value={block}>Block {block}</option>)}</select></label>
        <label><span className="prasadam-field-label">Flat Number <b>*</b></span><input required maxLength={10} value={form.flatNo} onChange={(event)=>update("flatNo",event.target.value.replace(/[\s-]/g,"").toUpperCase())} onBlur={()=>update("flatNo",normalizePrasadamFlatNo(form.flatNo,form.blockNo))} placeholder="e.g. 505 or C505"/><small>You may include the selected block letter. For example, <strong>C505</strong> will automatically become <strong>505</strong>.</small></label>
        <label><span className="prasadam-field-label">Resident Name <b>*</b></span><input required maxLength={100} value={form.residentName} onChange={(event)=>update("residentName",event.target.value)}/></label>
        <label><span className="prasadam-field-label">Mobile Number <b>*</b></span><span className="phone-field"><i>+91</i><input required type="tel" inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} value={form.phone} onChange={(event)=>update("phone",event.target.value.replace(/\D/g,"").slice(0,10))} placeholder="10-digit number"/></span></label>
      </div></fieldset>
      <fieldset><div className="prasadam-section-heading"><span>2</span><h2>Offering Details</h2></div><div className="field-grid">
        <label><span className="prasadam-field-label">Offering Date <b>*</b></span><select required disabled={!form.blockNo} value={form.offeringDate} onChange={(event)=>update("offeringDate",event.target.value)}><option value="" disabled>{form.blockNo?"Select an eligible date":"Choose your block first"}</option>{dates.map((day)=><option key={day.date} value={day.date}>Day {day.day} · {prasadamDateLabel(day.date)} · {day.label}</option>)}</select>{form.blockNo&&<small>Only Block {form.blockNo}’s assigned day and the open-offering day are available.</small>}</label>
        <label><span className="prasadam-field-label">Prasadam You Wish to Offer <b>*</b></span><input required maxLength={160} value={form.prasadamName} onChange={(event)=>update("prasadamName",event.target.value)} placeholder="e.g. Pulihora, sweet pongal, laddoo"/></label>
        <label><span className="prasadam-field-label">Number of Portions <b>*</b></span><input required type="number" inputMode="numeric" min="1" max="2000" value={form.portions} onChange={(event)=>update("portions",event.target.value)} placeholder="People who can be served"/><small>Please enter a practical estimate to help the team plan distribution.</small></label>
        <label><span className="prasadam-field-label">Preparation or Handover Notes <span className="optional">optional</span></span><textarea rows={3} maxLength={500} value={form.notes} onChange={(event)=>update("notes",event.target.value)} placeholder="Any timing, serving or coordination note for the pooja team"/></label>
      </div></fieldset>
      <aside className="prasadam-guidance"><strong>Please note</strong><ul><li>Prasadam seva is completely voluntary.</li><li>The pooja team may contact you to coordinate quantity, timing and handover.</li><li>Submit a separate entry for every prasadam or date you wish to offer.</li><li>Where practical, we request that sweets be prepared with moderate sugar so residents across age groups can enjoy the prasadam.</li><li>Daily prasadam will be served in the evening after pooja, subject to availability.</li></ul></aside>
      {error&&<p className="form-error" role="alert">{error}</p>}
      <button className="button primary full prasadam-submit" disabled={busy}>{busy?"Registering Offering…":"Register Prasadam Offering"}</button>
    </form></section>
  </>;
}

function normalizePrasadamFlatNo(flatNo:string,blockNo:string){
  const flat=flatNo.trim().toUpperCase().replace(/[\s-]+/g,"");const block=blockNo.trim().toUpperCase();
  return block&&flat.startsWith(block)&&/^(?:G|\d)/.test(flat.slice(block.length))?flat.slice(block.length):flat;
}
