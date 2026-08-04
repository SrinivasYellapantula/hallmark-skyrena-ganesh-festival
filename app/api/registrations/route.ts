import { ensureDatabase } from "../../../db/initialize";
import { getD1 } from "../../../db";
import { EVENT_ID, MINIMUM_DONATION } from "../../lib/constants";
import { cleanText, verifyTurnstile, wholeNumber } from "../../lib/server";

type RegistrationPayload = {
  residentName?: unknown;
  blockNo?: unknown;
  flatNo?: unknown;
  gotram?: unknown;
  occupancy?: unknown;
  phone?: unknown;
  mainDonation?: unknown;
  annadaanamDonation?: unknown;
  adultCount?: unknown;
  childCount?: unknown;
  paymentMethod?: unknown;
  paymentReference?: unknown;
  publicNameConsent?: unknown;
  notes?: unknown;
  turnstileToken?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegistrationPayload;
    if (!(await verifyTurnstile(request, body.turnstileToken))) {
      return Response.json({ error: "Please complete the anti-spam check." }, { status: 400 });
    }

    const residentName = cleanText(body.residentName, 100);
    const blockNo = cleanText(body.blockNo, 12).toUpperCase();
    const flatNo = cleanText(body.flatNo, 20).toUpperCase();
    const gotram = cleanText(body.gotram, 100);
    const occupancy = cleanText(body.occupancy, 10);
    const phone = cleanText(body.phone, 15).replace(/[^0-9+]/g, "");
    const mainDonation = wholeNumber(body.mainDonation, MINIMUM_DONATION);
    const annadaanamDonation = wholeNumber(body.annadaanamDonation, 0);
    const adultCount = wholeNumber(body.adultCount, 0, 30);
    const childCount = wholeNumber(body.childCount, 0, 30);
    const paymentMethod = cleanText(body.paymentMethod, 20);
    const paymentReference = cleanText(body.paymentReference, 80);
    const notes = cleanText(body.notes, 500);

    if (!residentName || !blockNo || !flatNo || !gotram) {
      return Response.json({ error: "Name, block, flat and gotram are required." }, { status: 400 });
    }
    if (!(["owner", "tenant"] as string[]).includes(occupancy)) {
      return Response.json({ error: "Choose owner or tenant." }, { status: 400 });
    }
    if (mainDonation === null || annadaanamDonation === null) {
      return Response.json(
        { error: `Main donation must be at least ₹${MINIMUM_DONATION.toLocaleString("en-IN")}.` },
        { status: 400 },
      );
    }
    if (adultCount === null || childCount === null) {
      return Response.json({ error: "Attendance counts must be between 0 and 30." }, { status: 400 });
    }
    if (!(["upi", "cash", "bank_transfer"] as string[]).includes(paymentMethod)) {
      return Response.json({ error: "Choose a valid payment method." }, { status: 400 });
    }
    if (paymentMethod !== "cash" && !paymentReference) {
      return Response.json({ error: "Payment reference is required for online payments." }, { status: 400 });
    }

    await ensureDatabase();
    const d1 = getD1();
    const duplicate = await d1
      .prepare(
        `SELECT reference_no FROM registrations
         WHERE event_id = ? AND block_no = ? AND flat_no = ? AND status != 'cancelled'
         LIMIT 1`,
      )
      .bind(EVENT_ID, blockNo, flatNo)
      .first<{ reference_no: string }>();

    const registrationId = crypto.randomUUID();
    const referenceNo = `GF26-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
    const donationStatus = paymentMethod === "cash" ? "pending" : "pending";
    const statements = [
      d1
        .prepare(
          `INSERT INTO registrations
          (id, reference_no, event_id, resident_name, block_no, flat_no, gotram,
           occupancy, phone, adult_count, child_count, public_name_consent, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          registrationId,
          referenceNo,
          EVENT_ID,
          residentName,
          blockNo,
          flatNo,
          gotram,
          occupancy,
          phone || null,
          adultCount,
          childCount,
          body.publicNameConsent === true ? 1 : 0,
          notes,
        ),
      d1
        .prepare(
          `INSERT INTO donations
          (id, registration_id, category, amount, payment_method, payment_reference, status)
          VALUES (?, ?, 'festival', ?, ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), registrationId, mainDonation, paymentMethod, paymentReference, donationStatus),
      d1
        .prepare(
          `INSERT INTO audit_log (id, entity_type, entity_id, action, actor, details)
           VALUES (?, 'registration', ?, 'submitted', 'resident', ?)`,
        )
        .bind(
          crypto.randomUUID(),
          registrationId,
          JSON.stringify({ blockNo, flatNo, duplicateOf: duplicate?.reference_no ?? null }),
        ),
    ];

    if (annadaanamDonation > 0) {
      statements.push(
        d1
          .prepare(
            `INSERT INTO donations
            (id, registration_id, category, amount, payment_method, payment_reference, status)
            VALUES (?, ?, 'annadaanam', ?, ?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            registrationId,
            annadaanamDonation,
            paymentMethod,
            paymentReference,
            donationStatus,
          ),
      );
    }

    await d1.batch(statements);
    return Response.json(
      {
        referenceNo,
        duplicateNotice: duplicate
          ? "Another submission exists for this flat. The committee will verify both entries."
          : null,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save the submission.";
    return Response.json({ error: message }, { status: 500 });
  }
}
