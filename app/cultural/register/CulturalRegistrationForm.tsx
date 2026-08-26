"use client";

import { FormEvent, useEffect, useState } from "react";
import { BLOCKS } from "../../lib/constants";
import { CULTURAL_CATEGORIES } from "../../lib/cultural";

type Participant = { name: string; age: string; blockNo: string; flatNo: string };
type User = { role: "admin" | "block" | "cultural"; displayName: string };
type EditableProgramme={id:string;referenceNo:string;title:string;performanceType:string;category:string;participantDetails:string;contactName:string;contactPhone:string;durationMinutes:number;backgroundMusic:number;hasAudio:number;audioName:string|null;notes:string};
const blankParticipant = (): Participant => ({ name: "", age: "", blockNo: "", flatNo: "" });

export function CulturalRegistrationForm({editToken="",editId=""}:{editToken?:string;editId?:string}) {
  const [performanceType,setPerformanceType]=useState("solo");
  const [participants,setParticipants]=useState<Participant[]>([blankParticipant()]);
  const [backgroundMusic,setBackgroundMusic]=useState("false");
  const [user,setUser]=useState<User|null>(null);
  const [initial,setInitial]=useState<EditableProgramme|null>(null);const [loading,setLoading]=useState(Boolean(editToken||editId));const [loadError,setLoadError]=useState("");
  const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [reference,setReference]=useState("");const [manageToken,setManageToken]=useState(editToken);

  useEffect(()=>{fetch("/api/auth/me",{cache:"no-store"}).then((response)=>response.ok?response.json():null).then(setUser).catch(()=>setUser(null));},[]);
  useEffect(()=>{if(!editToken&&!editId)return;const query=editToken?`editToken=${encodeURIComponent(editToken)}`:`id=${encodeURIComponent(editId)}`;fetch(`/api/cultural/programmes?${query}`,{cache:"no-store"}).then(async(response)=>{const payload=await response.json();if(!response.ok)throw new Error(payload.error??"Unable to open the cultural registration.");const programme=payload.programme as EditableProgramme;const parsed=JSON.parse(programme.participantDetails) as Array<{name:string;age:number;blockNo:string;flatNo:string}>;setInitial(programme);setPerformanceType(programme.performanceType);setBackgroundMusic(programme.backgroundMusic?"true":"false");setParticipants(parsed.map((item)=>({...item,age:String(item.age)})));}).catch((caught)=>setLoadError(caught instanceof Error?caught.message:"Unable to open the cultural registration.")).finally(()=>setLoading(false));},[editId,editToken]);

  function changeType(value:string){setPerformanceType(value);if(value==="solo")setParticipants((current)=>[current[0]??blankParticipant()]);else setParticipants((current)=>current.length===1?[...current,blankParticipant()]:current);}
  function updateParticipant(index:number,name:keyof Participant,value:string){setParticipants((current)=>current.map((participant,itemIndex)=>itemIndex===index?{...participant,[name]:value}:participant));}
  function addParticipant(){setParticipants((current)=>current.length>=30?current:[...current,blankParticipant()]);}
  function removeParticipant(index:number){setParticipants((current)=>current.length<=1?current:current.filter((_,itemIndex)=>itemIndex!==index));}

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");
    const body=new FormData(event.currentTarget);body.set("performanceType",performanceType);body.set("backgroundMusic",backgroundMusic);body.set("participantDetails",JSON.stringify(participants));if(editToken)body.set("editToken",editToken);if(editId)body.set("id",editId);
    const audio=body.get("audioTrack");
    if(audio instanceof File&&audio.size>8*1024*1024){setError("Upload an audio track up to 8 MB.");setBusy(false);return;}
    try{const response=await fetch("/api/cultural/programmes",{method:initial?"PUT":"POST",body});const payload=await response.json();if(!response.ok)throw new Error(payload.error??"Unable to save the cultural registration.");setReference(payload.referenceNo);setManageToken(payload.editToken??manageToken);window.scrollTo({top:0,behavior:"smooth"});}
    catch(caught){setError(caught instanceof Error?caught.message:"Unable to submit the cultural registration.");setBusy(false);}
  }

  if(loading)return <section className="wrap cultural-form-shell"><div className="admin-card empty-state"><p>Opening cultural registration…</p></div></section>;
  if(loadError)return <section className="wrap cultural-form-shell"><div className="admin-card empty-state"><p className="form-error">{loadError}</p></div></section>;
  if(reference){const editUrl=manageToken?`${window.location.origin}/cultural/register?edit=${encodeURIComponent(manageToken)}`:"";return <section className="wrap cultural-form-shell"><div className="cultural-success"><span>✓</span><p className="card-kicker">{initial?"Registration updated":"Registration received"}</p><h2>{initial?"Your changes are saved":"Thank you for participating!"}</h2><p>The Cultural Committee will review the entry and contact the primary contact person if anything else is needed.</p><div><small>Registration reference</small><strong>{reference}</strong></div>{editUrl&&<div className="cultural-edit-link"><small>Private resident edit link</small><p>Keep this link safely. Anyone with this link can edit this registration.</p><button className="button quiet" onClick={()=>void navigator.clipboard.writeText(editUrl)}>Copy Edit Link</button></div>}{user?<a className="button primary" href="/cultural">Return to Cultural Programme</a>:<button className="button primary" onClick={()=>{window.location.href="/cultural/register";}}>Submit Another Performance</button>}</div></section>;}

  return <section className="wrap cultural-form-shell">
    <form key={initial?.id??"new"} className="cultural-registration-form" onSubmit={submit}>
      <div className="cultural-form-note"><strong>{initial?"Editing registration":user?"Volunteer entry":"Resident registration"}</strong><span>{initial?`${initial.referenceNo} · Update the necessary details and save the entry.`:user?`Signed in as ${user.displayName}. This registration will be marked as entered by a volunteer.`:"No login is required. Please enter one performance per submission."}</span></div>

      <fieldset><h2 className="cultural-section-heading"><span>1</span>Performance Details</h2><div className="field-grid">
        <label><span className="cultural-field-label">Type <b>*</b></span><select value={performanceType} onChange={(event)=>changeType(event.target.value)}><option value="solo">Solo</option><option value="group">Group</option></select></label>
        <label><span className="cultural-field-label">Category <b>*</b></span><select name="category" required defaultValue={initial?.category??""}><option value="" disabled>Select category</option>{CULTURAL_CATEGORIES.map((category)=><option key={category}>{category}</option>)}</select></label>
        <label className="wide"><span className="cultural-field-label">Performance Title <b>*</b></span><input name="title" required maxLength={160} defaultValue={initial?.title??""} placeholder="Name of the song, dance, skit or performance"/></label>
        <label><span className="cultural-field-label">Duration in Minutes <b>*</b></span><input name="durationMinutes" required type="number" min="1" max="30" inputMode="numeric" defaultValue={initial?.durationMinutes} placeholder="e.g. 5"/></label>
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
        <label><span className="cultural-field-label">Contact Person&apos;s Name <b>*</b></span><input name="contactName" required maxLength={100} defaultValue={initial?.contactName??""}/></label>
        <label><span className="cultural-field-label">Mobile Number <b>*</b></span><span className="phone-field"><i>+91</i><input name="contactPhone" required type="tel" inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} defaultValue={initial?.contactPhone??""} placeholder="10-digit number" onInput={(event)=>{event.currentTarget.value=event.currentTarget.value.replace(/\D/g,"").slice(0,10);}}/></span></label>
      </div></fieldset>

      <fieldset><h2 className="cultural-section-heading"><span>4</span>Programme Requirements</h2><div className="field-grid">
        <label><span className="cultural-field-label">Background Music Required? <b>*</b></span><select value={backgroundMusic} onChange={(event)=>setBackgroundMusic(event.target.value)}><option value="false">No</option><option value="true">Yes</option></select></label>
        {backgroundMusic==="true"&&<label className="wide proof-picker">Audio Track <span className="optional">optional</span><input name="audioTrack" type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav"/><small>{initial?.hasAudio?`Current file: ${initial.audioName??"uploaded audio"}. Choose a new file only to replace it.`:"MP3, M4A or WAV up to 8 MB. You may submit now and share the final track with the committee later."}</small></label>}
        {performanceType==="group"&&<label className="wide"><span className="cultural-field-label">Group Notes <b>*</b></span><textarea name="notes" required rows={3} maxLength={600} defaultValue={initial?.notes??""} placeholder="Mention the expected total number of participants and an optional second point of contact for cross-verification."/></label>}
      </div></fieldset>
      <aside className="cultural-submission-guidelines"><span className="card-kicker">Please read before submitting</span><h2>Important Participation Guidelines</h2><ol><li><strong>Scheduling:</strong> Residents do not need to select a date or time slot. The organizing committee will assign the final schedule after reviewing the registrations.</li><li><strong>Group registration:</strong> Only one representative should submit the form for the entire group. Please avoid duplicate submissions by other group members.</li><li><strong>Multiple performances:</strong> The same person may submit separate forms for different performances, including entries for children or elders.</li><li><strong>Points of contact:</strong> One primary contact is sufficient. For a group, an optional second contact may be included in Group Notes.</li><li><strong>Participant count:</strong> Add every participating child by name. Only the names entered in the participant list will be counted; also mention the expected group total in Group Notes for cross-verification.</li><li><strong>Devotional theme:</strong> Only devotional or God-related songs are permitted, including film songs with an explicitly devotional theme.</li><li><strong>Final selection:</strong> Submission does not guarantee participation. The organizing committee will make the final selection and communicate the outcome.</li></ol><p>Thank you for your understanding and enthusiasm for our cultural programme.</p></aside>
      {error&&<p className="form-error" role="alert">{error}</p>}
      <button className="button primary cultural-submit" disabled={busy}>{busy?"Saving…":initial?"Save Registration Changes":"Submit Cultural Registration"}</button>
    </form>
  </section>;
}
