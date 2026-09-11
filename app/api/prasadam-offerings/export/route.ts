import writeXlsxFile from "write-excel-file";
import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { authorize, scopedBlock } from "../../../lib/auth";
import { BLOCKS, EVENT_ID } from "../../../lib/constants";

type Offering = { referenceNo:string; dayNumber:number; offeringDate:string; blockNo:string; flatNo:string; residentName:string; phone:string; prasadamName:string; portions:number; status:string; notes:string; createdAt:string };
const HEADERS=["Reference","Day","Offering Date","Block","Flat","Resident Name","Mobile Number","Prasadam","Portions","Status","Notes","Submitted At"];
const WIDTHS=[18,8,16,10,12,26,16,30,12,20,40,21].map((width)=>({width}));
const HEADER_STYLE={backgroundColor:"#466A4A",color:"#FFFFFF",fontWeight:"bold",align:"center" as const,alignVertical:"center" as const,wrap:true};

export async function GET(request:Request){
  const auth=await authorize(request,["admin","block","cultural"]);if("response" in auth)return auth.response;
  const url=new URL(request.url);const query=(url.searchParams.get("q")??"").trim().toLowerCase();
  const date=(url.searchParams.get("date")??"").trim();const status=(url.searchParams.get("status")??"").trim();const block=scopedBlock(auth.user,url.searchParams.get("block"));
  if(block&&!BLOCKS.includes(block as never))return Response.json({error:"Invalid block filter."},{status:400});
  await ensureDatabase();
  const result=await getD1().prepare(`SELECT reference_no referenceNo,day_number dayNumber,offering_date offeringDate,
    block_no blockNo,flat_no flatNo,resident_name residentName,phone,prasadam_name prasadamName,portions,notes,status,created_at createdAt
    FROM prasadam_offerings WHERE event_id=? AND (?='' OR block_no=?) AND (?='' OR offering_date=?) AND (?='' OR status=?)
    ORDER BY offering_date,block_no,CAST(REPLACE(flat_no,'G','0') AS INTEGER),created_at`)
    .bind(EVENT_ID,block,block,date,date,status,status).all<Offering>();
  const offerings=(result.results??[]).filter((item)=>`${item.residentName} ${item.blockNo} ${item.flatNo} ${item.phone} ${item.prasadamName} ${item.referenceNo}`.toLowerCase().includes(query));
  const portions=offerings.filter((item)=>item.status!=="cancelled").reduce((sum,item)=>sum+Number(item.portions),0);
  const generated=`Generated: ${new Date().toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})} · Offerings: ${offerings.length} · Portions: ${portions}`;
  const sheet=[
    [{value:"Hallmark Skyrena Prasadam Seva Plan",span:HEADERS.length,backgroundColor:"#B43120",color:"#FFFFFF",fontWeight:"bold",fontSize:16,height:30},...Array(HEADERS.length-1).fill(null)],
    [{value:generated,span:HEADERS.length,backgroundColor:"#FFF4DA",color:"#554638",fontSize:9,height:24},...Array(HEADERS.length-1).fill(null)],
    Array(HEADERS.length).fill(null),HEADERS.map((value)=>({value,...HEADER_STYLE,height:32})),
    ...(offerings.length?offerings.map((item)=>[item.referenceNo,item.dayNumber,item.offeringDate,item.blockNo,item.flatNo,item.residentName,`+91 ${item.phone}`,item.prasadamName,item.portions,statusLabel(item.status),item.notes,item.createdAt].map((value)=>({value,type:typeof value==="number"?Number:String,format:typeof value==="number"?"0":"@",wrap:true,alignVertical:"top" as const}))):[[{value:"No offerings match the selected filters.",span:HEADERS.length,color:"#746B61",fontStyle:"italic"},...Array(HEADERS.length-1).fill(null)]])
  ];
  const workbook=await writeXlsxFile(sheet,{columns:WIDTHS,stickyRowsCount:4,fontFamily:"Arial",fontSize:10,showGridLines:false,orientation:"landscape"});
  const filename=`hallmark-skyrena-prasadam-seva-${date||"all-days"}-${new Date().toISOString().slice(0,10)}.xlsx`;
  return new Response(await workbook.arrayBuffer(),{headers:{"content-type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","content-disposition":`attachment; filename="${filename}"`,"cache-control":"private, no-store"}});
}

function statusLabel(status:string){return status==="submitted"?"Awaiting confirmation":status.charAt(0).toUpperCase()+status.slice(1);}
