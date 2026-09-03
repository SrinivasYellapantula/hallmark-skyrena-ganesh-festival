import writeXlsxFile from "write-excel-file";
import { getD1 } from "../../../../../db";
import { ensureDatabase } from "../../../../../db/initialize";
import { authorize } from "../../../../lib/auth";
import { EVENT_ID } from "../../../../lib/constants";
import { CULTURAL_STATUS_LABELS } from "../../../../lib/cultural";

type Participant = { name?: string; age?: number; blockNo?: string; flatNo?: string };
type Programme = {
  referenceNo: string; title: string; performanceType: string; category: string;
  participantDetails: string; contactName: string; contactPhone: string;
  durationMinutes: number; status: string; coordinator: string; programmeDate: string;
  startTime: string; audioArrangement: string; audioName: string | null;
  deviceDetails: string; source: string; createdAt: string; notes: string;
};

const HEADERS = ["Reference", "Status", "Type", "Category", "Performance Title", "Duration (minutes)",
  "Participant Names", "Participant Ages", "Block & Flat", "Point of Contact", "Mobile Number",
  "Audio Arrangement", "Audio / Device Details", "Scheduled Date", "Start Time", "Coordinator",
  "Group Notes", "Submitted Through", "Submitted At"];
const WIDTHS = [18,20,12,22,30,16,35,18,28,24,16,24,38,16,14,24,38,18,20].map((width)=>({width}));
const HEADER_STYLE = { backgroundColor:"#466A4A", color:"#FFFFFF", fontWeight:"bold", align:"center" as const, alignVertical:"center" as const, wrap:true };

export async function GET(request: Request) {
  const auth = await authorize(request,["admin","cultural"]);
  if ("response" in auth) return auth.response;
  await ensureDatabase();
  const url = new URL(request.url);
  const status = (url.searchParams.get("status") ?? "active").trim();
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const date = (url.searchParams.get("date") ?? "").trim();
  const category = (url.searchParams.get("category") ?? "").trim();
  const scheduledOnly = url.searchParams.get("scheduled") === "true";
  const result = await getD1().prepare(`SELECT reference_no referenceNo,title,performance_type performanceType,
    category,participant_details participantDetails,contact_name contactName,contact_phone contactPhone,
    duration_minutes durationMinutes,status,coordinator,programme_date programmeDate,start_time startTime,
    audio_arrangement audioArrangement,audio_name audioName,device_details deviceDetails,source,created_at createdAt,notes
    FROM cultural_programmes WHERE event_id=? AND status<>'recycled'
    ORDER BY CASE WHEN programme_date='' THEN 1 ELSE 0 END,programme_date,start_time,created_at DESC`)
    .bind(EVENT_ID).all<Programme>();
  const programmes = (result.results ?? []).filter((item) => {
    const statusMatches = scheduledOnly ? item.status === "scheduled" : status === "all" ||
      (status === "active" ? !["withdrawn","completed"].includes(item.status) : item.status === status);
    const dateMatches = !date || item.programmeDate === date;
    const categoryMatches = !category || item.category === category;
    const searchable = `${item.referenceNo} ${item.title} ${item.category} ${item.participantDetails} ${item.contactName} ${item.contactPhone}`.toLowerCase();
    return statusMatches && dateMatches && categoryMatches && searchable.includes(query);
  });
  const rows = programmes.map((item) => {
    const people = parseParticipants(item.participantDetails);
    const arrangement = item.audioArrangement === "not_required" ? "Not required" : item.audioArrangement === "own_device" ? "Performer’s own device" : "Uploaded song";
    const audioDetails = item.audioArrangement === "not_required" ? "" : item.audioArrangement === "own_device" ? item.deviceDetails : (item.audioName ?? "Uploaded file");
    return [item.referenceNo,statusLabel(item.status),titleCase(item.performanceType),item.category,item.title,item.durationMinutes,
      people.map((person)=>person.name ?? "").join("\n"),people.map((person)=>person.age ?? "").join("\n"),
      people.map((person)=>`${person.blockNo ?? ""}-${person.flatNo ?? ""}`).join("\n"),item.contactName,item.contactPhone,
      arrangement,audioDetails,item.programmeDate,item.startTime,item.coordinator,item.notes,
      item.source === "resident" ? "Resident form" : "Volunteer entry",item.createdAt];
  });
  const generated = `Generated: ${new Date().toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})} · Registrations: ${programmes.length}`;
  const sheet = [
    [{value:"Cultural Programme Registrations",span:HEADERS.length,backgroundColor:"#B43120",color:"#FFFFFF",fontWeight:"bold",fontSize:16,height:30},...Array(HEADERS.length-1).fill(null)],
    [{value:generated,span:HEADERS.length,backgroundColor:"#FFF4DA",color:"#554638",fontSize:9,height:24},...Array(HEADERS.length-1).fill(null)],
    Array(HEADERS.length).fill(null),
    HEADERS.map((value)=>({value,...HEADER_STYLE,height:32})),
    ...(rows.length ? rows.map((row)=>row.map((value)=>({value,type:typeof value === "number" ? Number : String,format:typeof value === "number" ? "0" : "@",wrap:true,alignVertical:"top" as const}))) :
      [[{value:"No cultural registrations match the selected filters.",span:HEADERS.length,color:"#746B61",fontStyle:"italic"},...Array(HEADERS.length-1).fill(null)]])
  ];
  const workbook = await writeXlsxFile(sheet,{columns:WIDTHS,stickyRowsCount:4,fontFamily:"Arial",fontSize:10,showGridLines:false,orientation:"landscape"});
  const filename = `hallmark-skyrena-cultural-registrations-${new Date().toISOString().slice(0,10)}.xlsx`;
  return new Response(await workbook.arrayBuffer(),{headers:{
    "content-type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "content-disposition":`attachment; filename="${filename}"`,"cache-control":"private, no-store"
  }});
}

function parseParticipants(value:string):Participant[]{try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[];}catch{return [];}}
function statusLabel(value:string){return CULTURAL_STATUS_LABELS[value as keyof typeof CULTURAL_STATUS_LABELS] ?? titleCase(value.replaceAll("_"," "));}
function titleCase(value:string){return value ? value.charAt(0).toUpperCase()+value.slice(1).toLowerCase() : "";}
