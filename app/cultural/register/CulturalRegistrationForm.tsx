"use client";

import { FormEvent, useEffect, useState } from "react";
import { BLOCKS } from "../../lib/constants";
import { CULTURAL_CATEGORIES } from "../../lib/cultural";

type Participant = { name: string; age: string; blockNo: string; flatNo: string };
type User = { role: "admin" | "block" | "cultural"; displayName: string };
const blankParticipant = (): Participant => ({ name: "", age: "", blockNo: "", flatNo: "" });

export function CulturalRegistrationForm() {
  const [performanceType,setPerformanceType]=useState("solo");
  const [participants,setParticipants]=useState<Participant[]>([blankParticipant()]);
  const [backgroundMusic,setBackgroundMusic]=useState("false");
  const [user,setUser]=useState<User|null>(null);
  const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [reference,setReference]=useState("");

  useEffect(()=>{fetch("/api/auth/me",{cache:"no-store"}).then((response)=>response.ok?response.json():null).then(setUser).catch(()=>setUser(null));},[]);

  function changeType(value:string){setPerformanceType(value);if(value==="solo")setParticipants((current)=>[current[0]??blankParticipant()]);else setParticipants((current)=>current.length===1?[...current,blankParticipant()]:current);}
  function updateParticipant(index:number,name:keyof Participant,value:string){setParticipants((current)=>current.map((participant,itemIndex)=>itemIndex===index?{...participant,[name]:value}:participant));}
  function addParticipant(){setParticipants((current)=>current.length>=30?current:[...current,blankParticipant()]);}
  function removeParticipant(index:number){setParticipants((current)=>current.length<=1?current:current.filter((_,itemIndex)=>itemIndex!==index));}

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");
    const body=new FormData(event.currentTarget);body.set("performanceType",performanceType);body.set("backgroundMusic",backgroundMusic);body.set("participantDetails",JSON.stringify(participants));
    const audio=body.get("audioTrack");
    if(audio instanceof File&&audio.size>8*1024*1024){setError("Upload an audio track up to 8 MB.");setBusy(false);return;}
    try{const response=await fetch("/api/cultural/programmes",{method:"POST",body});const payload=await response.json();if(!response.ok)throw new Error(payload.error??"Unable to submit the cultural registration.");setReference(payload.referenceNo);window.scrollTo({top:0,behavior:"smooth"});}
    catch(caught){setError(caught instanceof Error?caught.message:"Unable to submit the cultural registration.");setBusy(false);}
  }

  if(reference)return <section className="wrap cultural-form-shell"><div className="cultural-success"><span>✓</span><p className="card-kicker">Registration received</p><h2>Thank you for participating!</h2><p>The Cultural Committee will review the entry and contact the primary contact person if anything else is needed.</p><div><small>Registration reference</small><strong>{reference}</strong></div><button className="button primary" onClick={()=>window.location.reload()}>Submit Another Performance</button></div></section>;

  return <section className="wrap cultural-form-shell">
    <form className="cultural-registration-form" onSubmit={submit}>
      <div className="cultural-form-note"><strong>{user?"Volunteer entry":"Resident registration"}</strong><span>{user?`Signed in as ${user.displayName}. This registration will be marked as entered by a volunteer.`:"No login is required. Please enter one performance per submission."}</span></div>

      <fieldset><h2 className="cultural-section-heading"><span>1</span>Performance Details</h2><div className="field-grid">
        <label><span className="cultural-field-label">Type <b>*</b></span><select value={performanceType} onChange={(event)=>changeType(event.target.value)}><option value="solo">Solo</option><option value="group">Group</option></select></label>
        <label><span className="cultural-field-label">Category <b>*</b></span><select name="category" required defaultValue=""><option value="" disabled>Select category</option>{CULTURAL_CATEGORIES.map((category)=><option key={category}>{category}</option>)}</select></label>
        <label className="wide"><span className="cultural-field-label">Performance Title <b>*</b></span><input name="title" required maxLength={160} placeholder="Name of the song, dance, skit or performance"/></label>
        <label><span className="cultural-field-label">Duration in Minutes <b>*</b></span><input name="durationMinutes" required type="number" min="1" max="30" inputMode="numeric" placeholder="e.g. 5"/></label>
      </div></fieldset>

      <fieldset><h2 className="cultural-section-heading"><span>2</span>Participant Details</h2><p className="fieldset-help">Add every participant separately. Flat numbers should not include the block letter.</p><div className="participant-editor">
        {participants.map((participant,index)=><article key={index}><header><strong>Participant {index+1}</strong>{performanceType==="group"&&participants.length>2&&<button type="button" onClick={()=>removeParticipant(index)}>Remove</button>}</header><div className="participant-fields">
          <label><span className="cultural-field-label">Name <b>*</b></span><input required value={participant.name} maxLength={100} onChange={(event)=>updateParticipant(index,"name",event.target.value)}/></label>
          <label><span className="cultural-field-label">Age <b>*</b></span><input required type="number" min="1" max="100" inputMode="numeric" value={participant.age} onChange={(event)=>updateParticipant(index,"age",event.target.value)}/></label>
          <label><span className="cultural-field-label">Block <b>*</b></span><select required value={participant.blockNo} onChange={(event)=>updateParticipant(index,"blockNo",event.target.value)}><option value="" disabled>Select</option>{BLOCKS.map((block)=><option key={block}>{block}</option>)}</select></label>
          <label><span className="cultural-field-label">Flat Number <b>*</b></span><input required value={participant.flatNo} maxLength={10} placeholder="e.g. 505 or 1505" onChange={(event)=>updateParticipant(index,"flatNo",event.target.value.toUpperCase())}/></label>
        </div></article>)}
      </div>{performanceType==="group"&&<button type="button" className="button quiet add-participant" onClick={addParticipant}>+ Add Participant</button>}</fieldset>

      <fieldset><h2 className="cultural-section-heading"><span>3</span>Primary Contact</h2><div className="field-grid">
        <label><span className="cultural-field-label">Contact Person&apos;s Name <b>*</b></span><input name="contactName" required maxLength={100}/></label>
        <label><span className="cultural-field-label">Mobile Number <b>*</b></span><span className="phone-field"><i>+91</i><input name="contactPhone" required type="tel" inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} placeholder="10-digit number" onInput={(event)=>{event.currentTarget.value=event.currentTarget.value.replace(/\D/g,"").slice(0,10);}}/></span></label>
      </div></fieldset>

      <fieldset><h2 className="cultural-section-heading"><span>4</span>Programme Requirements</h2><div className="field-grid">
        <label><span className="cultural-field-label">Background Music Required? <b>*</b></span><select value={backgroundMusic} onChange={(event)=>setBackgroundMusic(event.target.value)}><option value="false">No</option><option value="true">Yes</option></select></label>
        <label><span className="cultural-field-label">Approximate Setup Time (minutes) <b>*</b></span><input name="setupMinutes" required type="number" min="0" max="60" inputMode="numeric" defaultValue="0"/></label>
        {backgroundMusic==="true"&&<label className="wide proof-picker">Audio Track <span className="optional">optional</span><input name="audioTrack" type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav"/><small>MP3, M4A or WAV up to 8 MB. You may submit now and share the final track with the committee later.</small></label>}
        <label className="wide">Chairs, Tables or Other Stage Setup <span className="optional">optional</span><textarea name="stageRequirements" rows={3} maxLength={1000} placeholder="Mention the number of chairs/tables or any stage arrangement required"/></label>
        <label className="wide">Props or Special Arrangements <span className="optional">optional</span><textarea name="propsRequirements" rows={3} maxLength={1000} placeholder="Mention props, space or any special arrangement required"/></label>
      </div></fieldset>
      {error&&<p className="form-error" role="alert">{error}</p>}
      <button className="button primary cultural-submit" disabled={busy}>{busy?"Submitting…":"Submit Cultural Registration"}</button>
    </form>
  </section>;
}
