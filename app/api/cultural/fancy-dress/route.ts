import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { BLOCKS, EVENT_ID } from "../../../lib/constants";
import { FANCY_DRESS_DATE, FANCY_DRESS_DEADLINE, FANCY_DRESS_TIME } from "../../../lib/cultural";
import { cleanText, isValidFlatNo, normalizeFlatNo, wholeNumber } from "../../../lib/server";

export function GET(){return Response.json({closed:Date.now()>new Date(FANCY_DRESS_DEADLINE).getTime(),deadline:FANCY_DRESS_DEADLINE});}

export async function POST(request:Request){
  if(Date.now()>new Date(FANCY_DRESS_DEADLINE).getTime())return Response.json({error:"Fancy Dress registrations closed on 13 September 2026."},{status:403});
  const body=await request.json() as Record<string,unknown>;const blockNo=cleanText(body.blockNo,2).toUpperCase();const flatNo=normalizeFlatNo(body.flatNo,blockNo);const name=cleanText(body.name,100);const age=wholeNumber(body.age,1,100);const phone=cleanText(body.phone,20).replace(/\D/g,"");
  if(!BLOCKS.includes(blockNo as never))return Response.json({error:"Choose your block."},{status:400});
  if(!isValidFlatNo(flatNo,blockNo))return Response.json({error:`Enter a valid Block ${blockNo} flat number. You may include the selected block letter.`},{status:400});
  if(!name)return Response.json({error:"Enter the participant’s name."},{status:400});
  if(age===null)return Response.json({error:"Enter a valid age."},{status:400});
  if(!/^\d{10}$/.test(phone))return Response.json({error:"Enter a valid 10-digit mobile number."},{status:400});
  await ensureDatabase();const d1=getD1();const id=crypto.randomUUID();const referenceNo=`FD26-${crypto.randomUUID().replaceAll("-","").slice(0,8).toUpperCase()}`;const participants=JSON.stringify([{name,age,blockNo,flatNo}]);
  await d1.batch([
    d1.prepare(`INSERT INTO cultural_programmes (id,event_id,reference_no,title,performance_type,category,participant_details,coordinator,contact_name,contact_phone,block_no,flat_no,programme_date,start_time,duration_minutes,status,background_music,audio_arrangement,source,created_by,notes) VALUES(?,?,?,'Fancy Dress','solo','Fancy Dress',?,'',?,?,?,?,?,?,0,'submitted',0,'not_required','resident','resident-self-service','')`).bind(id,EVENT_ID,referenceNo,participants,name,phone,blockNo,flatNo,FANCY_DRESS_DATE,FANCY_DRESS_TIME),
    d1.prepare(`INSERT INTO audit_log(id,entity_type,entity_id,action,actor,details) VALUES(?,'cultural_programme',?,'submitted','resident-self-service',?)`).bind(crypto.randomUUID(),id,JSON.stringify({referenceNo,category:"Fancy Dress",blockNo,flatNo,programmeDate:FANCY_DRESS_DATE,startTime:FANCY_DRESS_TIME})),
  ]);
  return Response.json({ok:true,referenceNo},{status:201});
}
