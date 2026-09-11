import writeXlsxFile from "write-excel-file";
import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { authorize, scopedBlock } from "../../../lib/auth";
import { EVENT_ID } from "../../../lib/constants";
import { POOJA_LABELS, POOJA_TYPES, type PoojaType } from "../../../lib/pooja";

type Registration={referenceNo:string;poojaType:PoojaType;poojaDate:string;session:string;blockNo:string;flatNo:string;residentName:string;phone:string;attendeeCount:number;participantDetails:string;paymentAmount:number;paymentReference:string;paymentStatus:string;status:string;notes:string;createdAt:string};
const HEADERS=["Reference","Pooja","Date","Session","Block","Flat","Resident / Parent / Couple","Mobile","Attendees / Children","Child Details","Fee","Payment Status","UPI Reference","Registration Status","Notes","Submitted At"];
const WIDTHS=[17,23,15,12,9,11,27,16,18,34,13,18,21,19,36,21].map((width)=>({width}));
const HEADER_STYLE={backgroundColor:"#466A4A",color:"#FFFFFF",fontWeight:"bold",align:"center" as const,alignVertical:"center" as const,wrap:true};

export async function GET(request:Request){
  const auth=await authorize(request,["admin","block"]);if("response" in auth)return auth.response;
  const url=new URL(request.url);const query=(url.searchParams.get("q")??"").trim().toLowerCase();const type=(url.searchParams.get("type")??"").trim();
  if(type&&!POOJA_TYPES.includes(type as PoojaType))return Response.json({error:"Invalid Pooja filter."},{status:400});
  const block=scopedBlock(auth.user,url.searchParams.get("block"));await ensureDatabase();
  const result=await getD1().prepare(`SELECT reference_no referenceNo,pooja_type poojaType,pooja_date poojaDate,session,block_no blockNo,flat_no flatNo,resident_name residentName,phone,attendee_count attendeeCount,participant_details participantDetails,payment_amount paymentAmount,payment_reference paymentReference,payment_status paymentStatus,status,notes,created_at createdAt FROM pooja_registrations WHERE event_id=? AND (?='' OR block_no=?) AND (?='' OR pooja_type=?) ORDER BY pooja_date,session,block_no,CAST(REPLACE(flat_no,'G','0') AS INTEGER),created_at`).bind(EVENT_ID,block,block,type,type).all<Registration>();
  const registrations=(result.results??[]).filter((item)=>`${item.referenceNo} ${item.residentName} ${item.blockNo} ${item.flatNo} ${item.phone}`.toLowerCase().includes(query));
  const active=registrations.filter((item)=>item.status!=="cancelled");const attendees=active.reduce((sum,item)=>sum+Number(item.attendeeCount),0);
  const generated=`Generated: ${new Date().toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})} · Registrations: ${registrations.length} · Active attendees: ${attendees}`;
  const sheet=[
    [{value:"Hallmark Skyrena Pooja Registrations",span:HEADERS.length,backgroundColor:"#B43120",color:"#FFFFFF",fontWeight:"bold",fontSize:16,height:30},...Array(HEADERS.length-1).fill(null)],
    [{value:generated,span:HEADERS.length,backgroundColor:"#FFF4DA",color:"#554638",fontSize:9,height:24},...Array(HEADERS.length-1).fill(null)],
    Array(HEADERS.length).fill(null),HEADERS.map((value)=>({value,...HEADER_STYLE,height:32})),
    ...(registrations.length?registrations.map((item)=>[item.referenceNo,POOJA_LABELS[item.poojaType],item.poojaDate,label(item.session),item.blockNo,item.flatNo,item.residentName,`+91 ${item.phone}`,Number(item.attendeeCount),children(item.participantDetails),Number(item.paymentAmount),label(item.paymentStatus),item.paymentReference||"Not provided",label(item.status),item.notes,item.createdAt].map((value)=>({value,type:typeof value==="number"?Number:String,format:typeof value==="number"?"#,##0":"@",wrap:true,alignVertical:"top" as const}))):[[{value:"No registrations match the selected filters.",span:HEADERS.length,color:"#746B61",fontStyle:"italic"},...Array(HEADERS.length-1).fill(null)]])
  ];
  const workbook=await writeXlsxFile(sheet,{columns:WIDTHS,stickyRowsCount:4,fontFamily:"Arial",fontSize:10,showGridLines:false,orientation:"landscape"});
  const filename=`hallmark-skyrena-pooja-registrations-${type||"all"}-${new Date().toISOString().slice(0,10)}.xlsx`;
  return new Response(await workbook.arrayBuffer(),{headers:{"content-type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","content-disposition":`attachment; filename="${filename}"`,"cache-control":"private, no-store"}});
}

function label(value:string){return value?value.charAt(0).toUpperCase()+value.slice(1).replaceAll("_"," "):"—";}
function children(value:string){try{const parsed=JSON.parse(value) as Array<{name:string;age:number}>;return parsed.length?parsed.map((item)=>`${item.name} (${item.age})`).join(", "):"—";}catch{return "—";}}
