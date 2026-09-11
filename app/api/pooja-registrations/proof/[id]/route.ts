import { env } from "cloudflare:workers";
import { getD1 } from "../../../../../db";
import { ensureDatabase } from "../../../../../db/initialize";
import { authorize } from "../../../../lib/auth";

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const auth=await authorize(request,["admin","block"]);if("response" in auth)return auth.response;await ensureDatabase();const {id}=await params;
  const row=await getD1().prepare(`SELECT block_no blockNo,payment_proof_key proofKey,payment_proof_name proofName,payment_proof_type proofType FROM pooja_registrations WHERE id=? AND pooja_type='homam'`).bind(id).first<{blockNo:string;proofKey:string;proofName:string;proofType:string}>();
  if(!row||!row.proofKey||(auth.user.role==="block"&&row.blockNo!==auth.user.blockNo))return Response.json({error:"Payment proof not found."},{status:404});
  const store=(env as unknown as {PAYMENT_PROOFS?:KVNamespace}).PAYMENT_PROOFS;const object=await store?.get(row.proofKey,"arrayBuffer");if(!object)return Response.json({error:"Payment proof file not found."},{status:404});
  return new Response(object,{headers:{"content-type":row.proofType||"application/octet-stream","content-disposition":`inline; filename="${row.proofName.replaceAll('"','')}"`,"cache-control":"private, no-store"}});
}
