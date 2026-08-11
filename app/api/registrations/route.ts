import { env } from "cloudflare:workers";
import { ensureDatabase } from "../../../db/initialize";
import { getD1 } from "../../../db";
import { BLOCKS, EVENT_ID, MINIMUM_DONATION } from "../../lib/constants";
import { getAppUser, scopedBlock } from "../../lib/auth";
import { cleanText, wholeNumber } from "../../lib/server";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PROOF_BYTES = 1024 * 1024;

export async function POST(request: Request) {
  try {
    const user = await getAppUser(request);
    if (user?.role === "cultural") return Response.json({ error: "You do not have access to donation entry." }, { status: 403 });
    const actor = user?.username ?? "resident-self-service";
    const body = await request.formData();
    const residentName = cleanText(body.get("residentName"), 100);
    const blockNo = user ? scopedBlock(user, body.get("blockNo")) : cleanText(body.get("blockNo"), 2).toUpperCase();
    const flatNo = cleanText(body.get("flatNo"), 20).toUpperCase();
    const gotram = cleanText(body.get("gotram"), 100);
    const occupancy = cleanText(body.get("occupancy"), 10);
    const phone = cleanText(body.get("phone"), 15).replace(/[^0-9+]/g, "");
    const mainDonation = wholeNumber(body.get("mainDonation"), MINIMUM_DONATION);
    const idolDonation = wholeNumber(body.get("idolDonation"), 0);
    const annadaanamDonation = wholeNumber(body.get("annadaanamDonation"), 0);
    const adultCount = wholeNumber(body.get("adultCount"), 0, 7);
    const childCount = wholeNumber(body.get("childCount"), 0, 7);
    const paymentReference = cleanText(body.get("paymentReference"), 80);
    const notes = cleanText(body.get("notes"), 500);
    const proof = body.get("paymentProof");

    if (!residentName || !flatNo || !gotram || !phone || !BLOCKS.includes(blockNo as (typeof BLOCKS)[number]))
      return Response.json({ error: "Resident name, block, flat, gotram and phone number are required." }, { status: 400 });
    if ((user && !['owner', 'tenant'].includes(occupancy)) || (!user && occupancy && !['owner', 'tenant'].includes(occupancy)))
      return Response.json({ error: "Choose owner or tenant." }, { status: 400 });
    if (mainDonation === null || idolDonation === null || annadaanamDonation === null)
      return Response.json({ error: "Donation amounts must be valid non-negative whole numbers." }, { status: 400 });
    if (mainDonation + idolDonation + annadaanamDonation <= 0)
      return Response.json({ error: "Enter at least one donation amount greater than ₹0." }, { status: 400 });
    if (adultCount === null || childCount === null) return Response.json({ error: "Mahaprasadam attendance counts must be between 0 and 7." }, { status: 400 });
    if (!(proof instanceof File) || proof.size === 0) return Response.json({ error: "Payment confirmation image is required." }, { status: 400 });
    if (!IMAGE_TYPES.has(proof.type) || proof.size > MAX_PROOF_BYTES)
      return Response.json({ error: "Upload a JPG, PNG or WebP payment image up to 1 MB." }, { status: 400 });

    const proofStore = (env as unknown as { PAYMENT_PROOFS?: KVNamespace }).PAYMENT_PROOFS;
    if (!proofStore) throw new Error("Workers KV binding `PAYMENT_PROOFS` is unavailable.");
    await ensureDatabase();
    const d1 = getD1();
    if (user) {
      const masterFlat = await d1.prepare(`SELECT id FROM flats WHERE event_id=? AND block_no=? AND flat_no=? AND occupied=1 LIMIT 1`).bind(EVENT_ID, blockNo, flatNo).first();
      if (!masterFlat) return Response.json({ error: "Choose an occupied flat from the flat master." }, { status: 400 });
    }
    const registrationId = crypto.randomUUID();
    const donationId = crypto.randomUUID();
    const referenceNo = `GF26-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
    const proofKey = `${EVENT_ID}/${blockNo}/${registrationId}/${crypto.randomUUID()}`;
    await proofStore.put(proofKey, await proof.arrayBuffer(), {
      metadata: { originalName: proof.name, contentType: proof.type, uploadedBy: actor },
    });
    try {
      const statements = [
        d1.prepare(`INSERT INTO registrations
          (id, reference_no, event_id, resident_name, block_no, flat_no, gotram, occupancy, phone,
           adult_count, child_count, public_name_consent, notes, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(registrationId, referenceNo, EVENT_ID, residentName, blockNo, flatNo, gotram, occupancy, phone || null,
            adultCount, childCount, body.get("publicNameConsent") === "true" ? 1 : 0, notes, actor),
        d1.prepare(`INSERT INTO donations
          (id, registration_id, category, amount, payment_method, payment_reference, status,
           payment_proof_key, payment_proof_name, payment_proof_type)
          VALUES (?, ?, 'festival', ?, 'upi', ?, 'pending', ?, ?, ?)`)
          .bind(donationId, registrationId, mainDonation, paymentReference, proofKey, proof.name, proof.type),
        d1.prepare(`INSERT INTO flats (id, event_id, block_no, flat_no, resident_name, occupancy, occupied, visit_status, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, 1, 'donated', ?)
          ON CONFLICT(event_id, block_no, flat_no) DO UPDATE SET resident_name=excluded.resident_name,
          occupancy=CASE WHEN excluded.occupancy<>'' THEN excluded.occupancy ELSE flats.occupancy END,
          occupied=1, visit_status='donated', updated_by=excluded.updated_by, updated_at=CURRENT_TIMESTAMP`)
          .bind(crypto.randomUUID(), EVENT_ID, blockNo, flatNo, residentName, occupancy, actor),
        d1.prepare(`INSERT INTO audit_log (id, entity_type, entity_id, action, actor, details)
          VALUES (?, 'registration', ?, 'submitted', ?, ?)`)
          .bind(crypto.randomUUID(), registrationId, actor, JSON.stringify({ blockNo, flatNo, proofKey, source: user ? "committee" : "resident" })),
      ];
      if (annadaanamDonation > 0) statements.push(d1.prepare(`INSERT INTO donations
        (id, registration_id, category, amount, payment_method, payment_reference, status)
        VALUES (?, ?, 'annadaanam', ?, 'upi', ?, 'pending')`)
        .bind(crypto.randomUUID(), registrationId, annadaanamDonation, paymentReference));
      if (idolDonation > 0) statements.push(d1.prepare(`INSERT INTO donations
        (id, registration_id, category, amount, payment_method, payment_reference, status)
        VALUES (?, ?, 'idol', ?, 'upi', ?, 'pending')`)
        .bind(crypto.randomUUID(), registrationId, idolDonation, paymentReference));
      await d1.batch(statements);
      return Response.json({ referenceNo }, { status: 201 });
    } catch (error) {
      await proofStore.delete(proofKey);
      throw error;
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save the donation." }, { status: 500 });
  }
}
