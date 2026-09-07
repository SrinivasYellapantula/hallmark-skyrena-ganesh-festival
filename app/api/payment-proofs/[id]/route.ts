import { env } from "cloudflare:workers";
import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { authorize, isPortalOwner } from "../../../lib/auth";

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  const auth=await authorize(request); if("response" in auth)return auth.response; await ensureDatabase(); const {id}=await params;
  const url=new URL(request.url);
  if(!url.searchParams.get("payment")){
    const registration=await getD1().prepare(`SELECT resident_name residentName,block_no blockNo,flat_no flatNo,status FROM registrations WHERE id=?`).bind(id).first<{residentName:string;blockNo:string;flatNo:string;status:string}>();
    if(!registration||(auth.user.role==="block"&&registration.blockNo!==auth.user.blockNo)||(registration.status==="cancelled"&&!isPortalOwner(auth.user)))return Response.json({error:"Proofs not found."},{status:404});
    const payments=await getD1().prepare(`SELECT payment_reference paymentReference,payment_method paymentMethod,received_at receivedAt,
      SUM(amount) totalAmount,SUM(CASE WHEN category='festival' THEN amount ELSE 0 END) festivalAmount,
      SUM(CASE WHEN category='idol' THEN amount ELSE 0 END) idolAmount,SUM(CASE WHEN category='laddoos' THEN amount ELSE 0 END) laddooAmount,
      SUM(CASE WHEN category='annadaanam' THEN amount ELSE 0 END) mahaprasadamAmount,
      MAX(payment_proof_key) proofKey,MAX(payment_proof_name) proofName
      FROM donations WHERE registration_id=? AND status!='reversed'
      GROUP BY payment_reference,received_at ORDER BY received_at DESC`).bind(id).all<Record<string,unknown>>();
    const cards=payments.results.map((payment,index)=>`<article><h2>Payment ${payments.results.length-index}</h2><dl><div><dt>Date</dt><dd>${html(payment.receivedAt)}</dd></div><div><dt>Reference</dt><dd>${html(payment.paymentReference||"Not provided")}</dd></div><div><dt>Method</dt><dd>${html(String(payment.paymentMethod||"").toUpperCase())}</dd></div><div><dt>Main festival</dt><dd>₹${money(payment.festivalAmount)}</dd></div><div><dt>Idol</dt><dd>₹${money(payment.idolAmount)}</dd></div><div><dt>Laddoos</dt><dd>₹${money(payment.laddooAmount)}</dd></div><div><dt>Mahaprasadam</dt><dd>₹${money(payment.mahaprasadamAmount)}</dd></div><div class="total"><dt>Total</dt><dd>₹${money(payment.totalAmount)}</dd></div></dl>${payment.proofKey?`<a href="/api/payment-proofs/${encodeURIComponent(id)}?payment=${encodeURIComponent(String(payment.proofKey))}" target="_blank"><img src="/api/payment-proofs/${encodeURIComponent(id)}?payment=${encodeURIComponent(String(payment.proofKey))}" alt="Payment ${payments.results.length-index} confirmation"/><strong>Open full-size proof</strong></a>`:"<p>No proof attached to this historical payment.</p>"}</article>`).join("");
    return new Response(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment proofs</title><style>body{margin:0;padding:24px;background:#f6f0e5;color:#29241e;font-family:Arial,sans-serif}main{max-width:900px;margin:auto}header{margin-bottom:22px}h1{margin:5px 0;font-family:Georgia,serif}header p{color:#746b61}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}article{padding:20px;border:1px solid #d9cdbd;background:#fffaf1}article h2{margin-top:0;font-family:Georgia,serif}dl div{display:flex;justify-content:space-between;gap:20px;padding:7px 0;border-bottom:1px solid #e8dfd3;font-size:13px}dd{margin:0;text-align:right;font-weight:700}.total{font-size:16px;color:#b43120}article a{display:grid;gap:8px;margin-top:16px;color:#b43120;text-align:center;text-decoration:none}img{width:100%;max-height:520px;object-fit:contain;border:1px solid #ddd;background:#fff}@media(max-width:500px){body{padding:14px}}</style></head><body><main><header><small>PAYMENT HISTORY</small><h1>${html(registration.residentName)}</h1><p>Block ${html(registration.blockNo)}${registration.flatNo?` · Flat ${html(registration.flatNo)}`:""} · ${payments.results.length} payment${payments.results.length===1?"":"s"}</p></header><section class="grid">${cards||"<p>No active payments found.</p>"}</section></main></body></html>`,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"private, no-store"}});
  }
  const requestedProof=url.searchParams.get("payment");
  const row=await getD1().prepare(`SELECT r.block_no blockNo,r.status,d.payment_proof_key proofKey,d.payment_proof_name proofName,d.payment_proof_type proofType
    FROM registrations r JOIN donations d ON d.registration_id=r.id WHERE r.id=? AND d.payment_proof_key IS NOT NULL AND (? IS NULL OR d.payment_proof_key=?) ORDER BY d.received_at DESC LIMIT 1`).bind(id,requestedProof,requestedProof).first<{blockNo:string;status:string;proofKey:string;proofName:string;proofType:string}>();
  if(!row || (auth.user.role === "block" && row.blockNo !== auth.user.blockNo) || (row.status==="cancelled"&&!isPortalOwner(auth.user)))return Response.json({error:"Proof not found."},{status:404});
  const proofStore=(env as unknown as {PAYMENT_PROOFS?:KVNamespace}).PAYMENT_PROOFS;
  const object=await proofStore?.get(row.proofKey,"arrayBuffer");
  if(!object)return Response.json({error:"Proof file not found. A new upload can take a few seconds to become available."},{status:404});
  return new Response(object,{headers:{"content-type":row.proofType||"application/octet-stream","content-disposition":`inline; filename="${row.proofName.replaceAll('"','')}"`,"cache-control":"private, no-store"}});
}

function html(value:unknown){return String(value??"").replace(/[&<>"']/g,(character)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]??character);}
function money(value:unknown){return new Intl.NumberFormat("en-IN",{maximumFractionDigits:0}).format(Number(value)||0);}
