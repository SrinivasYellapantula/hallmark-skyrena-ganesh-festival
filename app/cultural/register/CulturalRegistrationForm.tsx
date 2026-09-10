"use client";

import { FormEvent, useEffect, useState } from "react";
import { BLOCKS } from "../../lib/constants";
import { CULTURAL_CATEGORIES } from "../../lib/cultural";

type Participant = { name: string; age: string; blockNo: string; flatNo: string };
type User = { role: "admin" | "block" | "cultural"; displayName: string };
type EditableProgramme={id:string;referenceNo:string;title:string;performanceType:string;category:string;participantDetails:string;contactName:string;contactPhone:string;durationMinutes:number;backgroundMusic:number;hasAudio:number;audioName:string|null;audioArrangement:string;deviceDetails:string;notes:string};
const blankParticipant = (): Participant => ({ name: "", age: "", blockNo: "", flatNo: "" });

export function CulturalRegistrationForm({editToken="",editId=""}:{editToken?:string;editId?:string}) {
  const [performanceType,setPerformanceType]=useState("solo");
  const [category,setCategory]=useState("");
  const [participants,setParticipants]=useState<Participant[]>([blankParticipant()]);
  const [audioArrangement,setAudioArrangement]=useState("");
  const [user,setUser]=useState<User|null>(null);
  const [authChecked,setAuthChecked]=useState(false);
  const [initial,setInitial]=useState<EditableProgramme|null>(null);const [loading,setLoading]=useState(Boolean(editToken||editId));const [loadError,setLoadError]=useState("");
  const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [reference,setReference]=useState("");const [manageToken,setManageToken]=useState(editToken);

  useEffect(()=>{fetch("/api/auth/me",{cache:"no-store"}).then((response)=>response.ok?response.json():null).then(setUser).catch(()=>setUser(null)).finally(()=>setAuthChecked(true));},[]);
  useEffect(()=>{if(!editToken&&!editId)return;const query=editToken?`editToken=${encodeURIComponent(editToken)}`:`id=${encodeURIComponent(editId)}`;fetch(`/api/cultural/programmes?${query}`,{cache:"no-store"}).then(async(response)=>{const payload=await response.json();if(!response.ok)throw new Error(payload.error??"Unable to open the cultural registration.");const programme=payload.programme as EditableProgramme;const parsed=JSON.parse(programme.participantDetails) as Array<{name:string;age:number;blockNo:string;flatNo:string}>;const kolatam=programme.category==="Kolatam";setInitial(programme);setCategory(programme.category);setPerformanceType(kolatam?"group":programme.performanceType);setAudioArrangement(programme.audioArrangement||(programme.hasAudio?"upload":"own_device"));setParticipants((kolatam?parsed.slice(0,1):parsed).map((item)=>({...item,age:String(item.age)})));}).catch((caught)=>setLoadError(caught instanceof Error?caught.message:"Unable to open the cultural registration.")).finally(()=>setLoading(false));},[editId,editToken]);

  function changeType(value:string){setPerformanceType(value);if(value==="solo")setParticipants((current)=>[current[0]??blankParticipant()]);else setParticipants((current)=>current.length===1?[...current,blankParticipant()]:current);}
  function changeCategory(value:string){setCategory(value);if(value==="Kolatam"){setPerformanceType("group");setParticipants((current)=>[current[0]??blankParticipant()]);}}
  function updateParticipant(index:number,name:keyof Participant,value:string){setParticipants((current)=>current.map((participant,itemIndex)=>itemIndex===index?{...participant,[name]:value}:participant));}
  function addParticipant(){setParticipants((current)=>current.length>=30?current:[...current,blankParticipant()]);}
  function removeParticipant(index:number){setParticipants((current)=>current.length<=1?current:current.filter((_,itemIndex)=>itemIndex!==index));}

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");
    const body=new FormData(event.currentTarget);body.set("performanceType",performanceType);body.set("category",category);body.set("audioArrangement",category==="Kolatam"?"not_required":audioArrangement);body.set("participantDetails",JSON.stringify(participants));if(category==="Kolatam"){body.set("title","Kolatam");body.set("durationMinutes","0");}if(editToken)body.set("editToken",editToken);if(editId)body.set("id",editId);
    const audio=body.get("audioTrack");
    if(audio instanceof File&&audio.size>8*1024*1024){setError("Upload an audio track up to 8 MB.");setBusy(false);return;}
    try{const response=await fetch("/api/cultural/programmes",{method:initial?"PUT":"POST",body});const payload=await response.json();if(!response.ok)throw new Error(payload.error??"Unable to save the cultural registration.");setReference(payload.referenceNo);setManageToken(payload.editToken??manageToken);window.scrollTo({top:0,behavior:"smooth"});}
    catch(caught){setError(caught instanceof Error?caught.message:"Unable to submit the cultural registration.");setBusy(false);}
  }

  if(!authChecked)return <section className="wrap cultural-form-shell"><div className="admin-card empty-state"><p>Checking registration availability…</p></div></section>;
  if(!user)return <section className="wrap cultural-form-shell"><div className="cultural-success cultural-registration-closed"><span aria-hidden="true">—</span><p className="card-kicker">Registration update</p><h2>Cultural registrations are closed now</h2><p>Thank you for your interest and enthusiasm. The Cultural Committee is no longer accepting new registrations.</p></div></section>;
  if(loading)return <section className="wrap cultural-form-shell"><div className="admin-card empty-state"><p>Opening cultural registration…</p></div></section>;
  if(loadError)return <section className="wrap cultural-form-shell"><div className="admin-card empty-state"><p className="form-error">{loadError}</p></div></section>;
  if(reference){const editUrl=manageToken?`${window.location.origin}/cultural/register?edit=${encodeURIComponent(manageToken)}`:"";return <section className="wrap cultural-form-shell"><div className="cultural-success"><span>✓</span><p className="card-kicker">{initial?"Registration updated":"Registration received"}</p><h2>{initial?"Your changes are saved":"Thank you for participating!"}</h2><p>The Cultural Committee will review the entry and contact the participant/group point of contact if anything else is needed.</p><div><small>Registration reference</small><strong>{reference}</strong></div>{editUrl&&<div className="cultural-edit-link"><small>Private resident edit link</small><p>Keep this link safely. Anyone with this link can edit this registration.</p><button className="button quiet" onClick={()=>void navigator.clipboard.writeText(editUrl)}>Copy Edit Link</button></div>}{user?<a className="button primary" href="/cultural">Return to Cultural Programme</a>:<button className="button primary" onClick={()=>{window.location.href="/cultural/register";}}>Submit Another Performance</button>}</div></section>;}

  return <section className="wrap cultural-form-shell">
    <form key={initial?.id??"new"} className="cultural-registration-form" onSubmit={submit}>
      <div className="cultural-form-note"><strong>{initial?"Editing registration":user?"Volunteer entry":"Resident registration"}</strong><span>{initial?`${initial.referenceNo} · Update the necessary details and save the entry.`:user?`Signed in as ${user.displayName}. This registration will be marked as entered by a volunteer.`:"No login is required. Please enter one performance per submission."}</span></div>

      <fieldset><h2 className="cultural-section-heading"><span>1</span>Performance Details</h2><div className="field-grid">
        <label><span className="cultural-field-label">Type <b>*</b></span><select disabled={category==="Kolatam"} value={performanceType} onChange={(event)=>changeType(event.target.value)}><option value="solo">Solo</option><option value="group">Group</option></select>{category==="Kolatam"&&<small>Automatically set to Group for Kolatam.</small>}</label>
        <label><span className="cultural-field-label">Category <b>*</b></span><select name="category" required value={category} onChange={(event)=>changeCategory(event.target.value)}><option value="" disabled>Select category</option>{CULTURAL_CATEGORIES.map((category)=><option key={category}>{category}</option>)}</select></label>
        <label className="wide"><span className="cultural-field-label">Performance Title {category!=="Kolatam"&&<b>*</b>}</span><input name="title" required={category!=="Kolatam"} disabled={category==="Kolatam"} maxLength={160} defaultValue={initial?.title??""} placeholder={category==="Kolatam"?"Not required for Kolatam":"Name of the song, dance, skit or performance"}/></label>
        <label><span className="cultural-field-label">Duration in Minutes {category!=="Kolatam"&&<b>*</b>}</span><input name="durationMinutes" required={category!=="Kolatam"} disabled={category==="Kolatam"} type="number" min="1" max="30" inputMode="numeric" defaultValue={initial?.durationMinutes} placeholder={category==="Kolatam"?"Not required":"e.g. 5"}/></label>
      </div></fieldset>

      <fieldset><h2 className="cultural-section-heading"><span>2</span>Participant Details</h2><p className="fieldset-help">{category==="Kolatam"?"Enter only one representative for this Kolatam registration. Flat number should not include the block letter.":"Add every participant separately. Flat numbers should not include the block letter."}</p><div className="participant-editor">
        {participants.map((participant,index)=><article key={index}><header><strong>{category==="Kolatam"?"Kolatam Representative":`Participant ${index+1}`}</strong>{category!=="Kolatam"&&performanceType==="group"&&participants.length>2&&<button type="button" onClick={()=>removeParticipant(index)}>Remove</button>}</header><div className="participant-fields">
          <label><span className="cultural-field-label">Name <b>*</b></span><input required value={participant.name} maxLength={100} onChange={(event)=>updateParticipant(index,"name",event.target.value)}/></label>
          <label><span className="cultural-field-label">Age <b>*</b></span><input required type="number" min="1" max="100" inputMode="numeric" value={participant.age} onChange={(event)=>updateParticipant(index,"age",event.target.value)}/></label>
          <label><span className="cultural-field-label">Block <b>*</b></span><select required value={participant.blockNo} onChange={(event)=>updateParticipant(index,"blockNo",event.target.value)}><option value="" disabled>Select</option>{BLOCKS.map((block)=><option key={block}>{block}</option>)}</select></label>
          <label><span className="cultural-field-label">Flat Number <b>*</b></span><input required value={participant.flatNo} maxLength={10} placeholder="e.g. 505 or 1505" onChange={(event)=>updateParticipant(index,"flatNo",event.target.value.toUpperCase())}/></label>
        </div></article>)}
      </div>{category!=="Kolatam"&&performanceType==="group"&&<button type="button" className="button quiet add-participant" onClick={addParticipant}>+ Add Participant</button>}</fieldset>

      <fieldset><h2 className="cultural-section-heading"><span>3</span>Participant / Group Point of Contact</h2><p className="fieldset-help">Person the Cultural Committee should contact about this performance. This may be the participant, parent/guardian or group representative.</p><div className="field-grid">
        <label><span className="cultural-field-label">Point of Contact Name <b>*</b></span><input name="contactName" required maxLength={100} defaultValue={initial?.contactName??""}/></label>
        <label><span className="cultural-field-label">Mobile Number <b>*</b></span><span className="phone-field"><i>+91</i><input name="contactPhone" required type="tel" inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} defaultValue={initial?.contactPhone??""} placeholder="10-digit number" onInput={(event)=>{event.currentTarget.value=event.currentTarget.value.replace(/\D/g,"").slice(0,10);}}/></span></label>
      </div></fieldset>

      {category!=="Kolatam"&&<fieldset><h2 className="cultural-section-heading"><span>4</span>Programme Requirements</h2><div className="field-grid">
        <label className="wide"><span className="cultural-field-label">Music / Audio Arrangement <b>*</b></span><select required value={audioArrangement} onChange={(event)=>setAudioArrangement(event.target.value)}><option value="" disabled>Select audio arrangement</option><option value="upload">Upload the song file</option><option value="own_device">Performer will play from their own device</option></select></label>
        {audioArrangement==="upload"&&<label className="wide proof-picker"><span className="cultural-field-label">Song File <b>*</b></span><input name="audioTrack" required={!initial?.hasAudio} type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav"/><small>{initial?.hasAudio?`Current file: ${initial.audioName??"uploaded audio"}. Choose a new file only to replace it.`:"Upload an MP3, M4A or WAV file up to 8 MB."}</small></label>}
        {audioArrangement==="own_device"&&<label className="wide"><span className="cultural-field-label">Device and Connection Details <b>*</b></span><textarea name="deviceDetails" required rows={3} maxLength={500} defaultValue={initial?.deviceDetails??""} placeholder="Example: iPhone with Lightning adapter, Android USB-C or laptop with 3.5 mm audio output"/><small>Please bring the song downloaded for offline playback. The performer must attend the committee’s sound check before the programme.</small></label>}
        {performanceType==="group"&&<label className="wide"><span className="cultural-field-label">Group Notes <b>*</b></span><textarea name="notes" required rows={3} maxLength={600} defaultValue={initial?.notes??""} placeholder="Mention the expected total number of participants and an optional second point of contact for cross-verification."/></label>}
      </div></fieldset>}
      <aside className="cultural-submission-guidelines"><span className="card-kicker">Please read before submitting</span><h2>Important Participation Guidelines</h2><ol><li><strong>Scheduling:</strong> Residents do not need to select a date or time slot. The organizing committee will assign the final schedule after reviewing the registrations.</li><li><strong>Group registration:</strong> Only one representative should submit the form for the entire group. Please avoid duplicate submissions by other group members.</li><li><strong>Multiple performances:</strong> The same person may submit separate forms for different performances, including entries for children or elders.</li><li><strong>Participant/group point of contact:</strong> One point of contact is sufficient. For a group, an optional second contact may be included in Group Notes.</li>{category==="Kolatam"?<li><strong>Kolatam registration:</strong> Enter only one representative. The Cultural Committee will coordinate the complete participant list separately.</li>:<li><strong>Participant count:</strong> Add every participating child by name. Only the names entered in the participant list will be counted; also mention the expected group total in Group Notes for cross-verification.</li>}<li><strong>Devotional theme:</strong> Only devotional or God-related songs are permitted, including film songs with an explicitly devotional theme.</li><li><strong>Final selection:</strong> Submission does not guarantee participation. The organizing committee will make the final selection and communicate the outcome.</li></ol><p>Thank you for your understanding and enthusiasm for our cultural programme.</p></aside>
      {error&&<p className="form-error" role="alert">{error}</p>}
      <button className="button primary cultural-submit" disabled={busy}>{busy?"Saving…":initial?"Save Registration Changes":"Submit Cultural Registration"}</button>
    </form>
  </section>;
}
