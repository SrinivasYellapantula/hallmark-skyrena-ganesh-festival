"use client";

import { FormEvent, useMemo, useState } from "react";
import Script from "next/script";
import { BLOCKS, MINIMUM_DONATION, currency } from "../lib/constants";

type Success = { referenceNo: string; duplicateNotice?: string | null };

const initial = {
  residentName: "", blockNo: "", flatNo: "", gotram: "", occupancy: "owner",
  phone: "", mainDonation: "1000", annadaanamDonation: "0", adultCount: "0",
  childCount: "0", paymentMethod: "upi", paymentReference: "", notes: "",
  publicNameConsent: false,
};

export function ContributionForm() {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<Success | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const total = useMemo(
    () => Math.max(0, Number(form.mainDonation) || 0) + Math.max(0, Number(form.annadaanamDonation) || 0),
    [form.mainDonation, form.annadaanamDonation],
  );

  function update(name: string, value: string | boolean) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/registrations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, turnstileToken }),
      });
      const payload = (await response.json()) as Success & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Submission failed.");
      setSuccess(payload);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <section className="wrap compact success-panel" role="status">
        <div className="success-icon">✓</div>
        <div className="eyebrow"><span /> Submission received</div>
        <h2>Thank you for contributing.</h2>
        <p>Your committee will verify the payment before it appears in public totals.</p>
        <div className="reference-card"><small>Your reference number</small><strong>{success.referenceNo}</strong></div>
        {success.duplicateNotice && <p className="notice">{success.duplicateNotice}</p>}
        <button className="button quiet" onClick={() => { setSuccess(null); setForm(initial); }}>Add another household</button>
      </section>
    );
  }

  return (
    <form className="wrap form-shell" onSubmit={submit}>
      <div className="form-main">
        <fieldset>
          <legend><span>1</span> Household details</legend>
          <div className="field-grid">
            <label className="wide">Name of resident<input required name="residentName" autoComplete="name" value={form.residentName} onChange={(e) => update(e.target.name, e.target.value)} placeholder="Full name" /></label>
            <label>Block<select required name="blockNo" value={form.blockNo} onChange={(e) => update(e.target.name, e.target.value)}><option value="">Choose</option>{BLOCKS.map((block) => <option key={block}>{block}</option>)}</select></label>
            <label>Flat number<input required name="flatNo" value={form.flatNo} onChange={(e) => update(e.target.name, e.target.value)} placeholder="e.g. 1204" /></label>
            <label>Gotram<input required name="gotram" value={form.gotram} onChange={(e) => update(e.target.name, e.target.value)} placeholder="Enter gotram" /></label>
            <label>Occupancy<select name="occupancy" value={form.occupancy} onChange={(e) => update(e.target.name, e.target.value)}><option value="owner">Owner</option><option value="tenant">Tenant</option></select></label>
            <label className="wide">Phone number <span className="optional">optional</span><input name="phone" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => update(e.target.name, e.target.value)} placeholder="For payment clarification only" /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend><span>2</span> Contribution</legend>
          <div className="field-grid">
            <label>Main festival donation<input required name="mainDonation" type="number" inputMode="numeric" min={MINIMUM_DONATION} step="100" value={form.mainDonation} onChange={(e) => update(e.target.name, e.target.value)} /><small>Minimum ₹1,000</small></label>
            <label>Extra for Annadaanam<input name="annadaanamDonation" type="number" inputMode="numeric" min="0" step="100" value={form.annadaanamDonation} onChange={(e) => update(e.target.name, e.target.value)} /></label>
            <label>Payment method<select name="paymentMethod" value={form.paymentMethod} onChange={(e) => update(e.target.name, e.target.value)}><option value="upi">UPI</option><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option></select></label>
            <label>Payment reference {form.paymentMethod === "cash" && <span className="optional">optional</span>}<input name="paymentReference" required={form.paymentMethod !== "cash"} value={form.paymentReference} onChange={(e) => update(e.target.name, e.target.value)} placeholder="UTR / UPI reference" /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend><span>3</span> Annadaanam attendance</legend>
          <p className="fieldset-help">Please enter zero if nobody from your household will attend.</p>
          <div className="field-grid">
            <label>Adults / elders<input required name="adultCount" type="number" inputMode="numeric" min="0" max="30" value={form.adultCount} onChange={(e) => update(e.target.name, e.target.value)} /></label>
            <label>Children<input required name="childCount" type="number" inputMode="numeric" min="0" max="30" value={form.childCount} onChange={(e) => update(e.target.name, e.target.value)} /></label>
            <label className="wide">Notes <span className="optional">optional</span><textarea name="notes" rows={3} value={form.notes} onChange={(e) => update(e.target.name, e.target.value)} placeholder="Dietary or committee note" /></label>
          </div>
        </fieldset>

        <label className="consent"><input type="checkbox" checked={form.publicNameConsent} onChange={(e) => update("publicNameConsent", e.target.checked)} /><span><strong>Show my name on the public donor wall</strong><small>Your flat, gotram, phone and attendance are always private.</small></span></label>
        {turnstileSiteKey && (
          <div className="turnstile-wrap">
            <Script
              src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
              onLoad={() => {
                const turnstile = (window as unknown as { turnstile?: { render: (selector: string, options: Record<string, unknown>) => void } }).turnstile;
                turnstile?.render("#turnstile-widget", {
                  sitekey: turnstileSiteKey,
                  callback: (token: string) => setTurnstileToken(token),
                  "expired-callback": () => setTurnstileToken(""),
                });
              }}
            />
            <div id="turnstile-widget" />
          </div>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>

      <aside className="form-summary">
        <span className="summary-label">Contribution summary</span>
        <div><span>Festival</span><strong>{currency(Number(form.mainDonation) || 0)}</strong></div>
        <div><span>Annadaanam</span><strong>{currency(Number(form.annadaanamDonation) || 0)}</strong></div>
        <div className="summary-total"><span>Total</span><strong>{currency(total)}</strong></div>
        <button className="button primary full" disabled={busy || Boolean(turnstileSiteKey && !turnstileToken)}>{busy ? "Submitting…" : "Submit contribution"}</button>
        <p>Payments remain pending until verified by the committee.</p>
      </aside>
    </form>
  );
}
