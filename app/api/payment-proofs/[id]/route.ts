import { env } from "cloudflare:workers";
import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { authorize } from "../../../lib/auth";

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  const auth=await authorize(request); if("response" in auth)return auth.response; await ensureDatabase(); const {id}=await params;
  const row=await getD1().prepare(`SELECT r.block_no blockNo,d.payment_proof_key proofKey,d.payment_proof_name proofName,d.payment_proof_type proofType
    FROM registrations r JOIN donations d ON d.registration_id=r.id WHERE r.id=? AND d.payment_proof_key IS NOT NULL LIMIT 1`).bind(id).first<{blockNo:string;proofKey:string;proofName:string;proofType:string}>();
  if(!row || (auth.user.role === "block" && row.blockNo !== auth.user.blockNo))return Response.json({error:"Proof not found."},{status:404});
  const proofStore=(env as unknown as {PAYMENT_PROOFS?:KVNamespace}).PAYMENT_PROOFS;
  const object=await proofStore?.get(row.proofKey,"arrayBuffer");
  if(!object)return Response.json({error:"Proof file not found. A new upload can take a few seconds to become available."},{status:404});
  return new Response(object,{headers:{"content-type":row.proofType||"application/octet-stream","content-disposition":`inline; filename="${row.proofName.replaceAll('"','')}"`,"cache-control":"private, no-store"}});
}
