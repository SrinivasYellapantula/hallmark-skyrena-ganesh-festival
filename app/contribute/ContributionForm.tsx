"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BLOCKS, MINIMUM_DONATION, currency } from "../lib/constants";

type User = { role: "admin" | "block"; blockNo: string | null };
type Success = { referenceNo: string };

const blank = {
  residentName: "",
  blockNo: "",
  flatNo: "",
  gotram: "",
  occupancy: "",
  phone: "",
  mainDonation: "2000",
  annadaanamDonation: "0",
  adultCount: "0",
  childCount: "0",
  paymentReference: "",
};
const ATTENDANCE_OPTIONS = Array.from({ length: 8 }, (_, index) => String(index));
const MAX_STORED_PROOF_BYTES = 1024 * 1024;

async function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
}

async function optimizePaymentProof(file: File) {
  if (file.size <= MAX_STORED_PROOF_BYTES) return file;
  const bitmap = await createImageBitmap(file);
  let width = bitmap.width;
  let height = bitmap.height;
  const initialScale = Math.min(1, 1600 / Math.max(width, height));
  width = Math.max(1, Math.round(width * initialScale));
  height = Math.max(1, Math.round(height * initialScale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("This browser cannot optimize the selected image.");
  }
  let blob: Blob | null = null;
  for (const quality of [0.82, 0.7, 0.58]) {
    canvas.width = width;
    canvas.height = height;
    context.drawImage(bitmap, 0, 0, width, height);
    blob = await canvasBlob(canvas, quality);
    if (blob && blob.size <= MAX_STORED_PROOF_BYTES) break;
    if (blob) {
      const scale = Math.min(0.9, Math.sqrt(MAX_STORED_PROOF_BYTES / blob.size) * 0.9);
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }
  }
  bitmap.close();
  if (!blob || blob.size > MAX_STORED_PROOF_BYTES)
    throw new Error("The payment image is still too large. Please take a screenshot or crop it and try again.");
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "payment-proof"}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

export function ContributionForm() {
  const [form, setForm] = useState(blank);
  const [user, setUser] = useState<User | null>(null);
  const [proof, setProof] = useState<File | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<Success | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((profile: User) => {
        setUser(profile);
        if (profile.role === "block") setForm((current) => ({ ...current, blockNo: profile.blockNo ?? "" }));
      })
      .catch(() => setError("Unable to load your access profile."));
  }, []);

  const total = useMemo(
    () => Number(form.mainDonation || 0) + Number(form.annadaanamDonation || 0),
    [form.mainDonation, form.annadaanamDonation],
  );

  function update(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function selectProof(file: File | null) {
    setProof(null);
    setError("");
    if (!file) return;
    setOptimizing(true);
    try {
      setProof(await optimizePaymentProof(file));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to optimize the payment image.");
    } finally {
      setOptimizing(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!proof) {
      setError("Capture or upload the UPI payment confirmation.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => data.set(key, value));
      data.set("paymentProof", proof);
      const response = await fetch("/api/registrations", { method: "POST", body: data });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Submission failed.");
      setSuccess(payload);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (success) return (
    <section className="wrap compact success-panel">
      <div className="success-icon">✓</div>
      <div className="eyebrow"><span />Donation recorded</div>
      <h2>Payment submitted for verification.</h2>
      <div className="reference-card"><small>Reference number</small><strong>{success.referenceNo}</strong></div>
      <button className="button quiet" onClick={() => {
        setSuccess(null);
        setProof(null);
        setForm({ ...blank, blockNo: user?.blockNo ?? "" });
      }}>Add another donation</button>
    </section>
  );

  return (
    <form className="wrap form-shell" onSubmit={submit}>
      <div className="form-main">
        <fieldset aria-labelledby="household-section-title">
          <div className="form-section-heading" id="household-section-title"><span>1</span><h2>Household Details</h2></div>
          <p className="fieldset-help">All household details are mandatory.</p>
          <div className="field-grid">
            <label className="wide">Resident Name
              <input required name="residentName" autoComplete="name" value={form.residentName} onChange={(event) => update(event.target.name, event.target.value)} />
            </label>
            <label>Block
              <select required name="blockNo" disabled={user?.role === "block"} value={form.blockNo} onChange={(event) => update(event.target.name, event.target.value)}>
                <option value="">Select block</option>
                {BLOCKS.map((block) => <option key={block} value={block}>Block {block}</option>)}
              </select>
              {user?.role === "block" && <small>Locked to Block {user.blockNo}</small>}
            </label>
            <label>Flat Number
              <input required name="flatNo" value={form.flatNo} onChange={(event) => update(event.target.name, event.target.value)} />
            </label>
            <label>Gotram
              <input required name="gotram" value={form.gotram} onChange={(event) => update(event.target.name, event.target.value)} />
            </label>
            <label>Occupancy
              <select required name="occupancy" value={form.occupancy} onChange={(event) => update(event.target.name, event.target.value)}>
                <option value="">Select occupancy</option>
                <option value="owner">Owner</option>
                <option value="tenant">Tenant</option>
              </select>
            </label>
            <label className="wide">Phone No.
              <input required name="phone" type="tel" inputMode="tel" autoComplete="tel" minLength={10} maxLength={15} value={form.phone} onChange={(event) => update(event.target.name, event.target.value)} />
            </label>
          </div>
        </fieldset>

        <fieldset aria-labelledby="contributions-section-title">
          <div className="form-section-heading" id="contributions-section-title"><span>2</span><h2>Contributions</h2></div>
          <div className="field-grid">
            <label>Donation Amount
              <input required name="mainDonation" type="number" inputMode="numeric" min={MINIMUM_DONATION} step="100" value={form.mainDonation} onChange={(event) => update(event.target.name, event.target.value)} />
              <small>Minimum and default ₹2,000</small>
            </label>
            <label>Other Donations Amount
              <input name="annadaanamDonation" type="number" inputMode="numeric" min="0" step="100" value={form.annadaanamDonation} onChange={(event) => update(event.target.name, event.target.value)} />
              <small>Enter 0 when there is no additional contribution.</small>
            </label>
            <label className="wide">UPI Transaction Reference No.
              <input required name="paymentReference" value={form.paymentReference} onChange={(event) => update(event.target.name, event.target.value)} placeholder="UPI / UTR reference" />
            </label>
            <label className="wide proof-picker">Payment Confirmation Image
              <input required type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => void selectProof(event.target.files?.[0] ?? null)} />
              <small>On mobile, choose Camera to photograph the confirmation. Large images are automatically compressed for private storage.</small>
              {optimizing && <strong>Optimizing image…</strong>}
              {proof && <strong>Ready: {proof.name} ({Math.ceil(proof.size / 1024)} KB)</strong>}
            </label>
          </div>
        </fieldset>

        <fieldset aria-labelledby="attendance-section-title">
          <div className="form-section-heading" id="attendance-section-title"><span>3</span><h2>Lunch Mahaprasadam Attendance</h2></div>
          <div className="field-grid">
            <label>No. of Adults
              <select required name="adultCount" value={form.adultCount} onChange={(event) => update(event.target.name, event.target.value)}>
                {ATTENDANCE_OPTIONS.map((count) => <option key={count} value={count}>{count}</option>)}
              </select>
            </label>
            <label>No. of Kids <span className="label-note">(below 10 yrs)</span>
              <select required name="childCount" value={form.childCount} onChange={(event) => update(event.target.name, event.target.value)}>
                {ATTENDANCE_OPTIONS.map((count) => <option key={count} value={count}>{count}</option>)}
              </select>
            </label>
          </div>
        </fieldset>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>

      <aside className="form-summary">
        <span className="summary-label">Donation Summary</span>
        <div><span>Donation</span><strong>{currency(Number(form.mainDonation) || 0)}</strong></div>
        <div><span>Mahaprasadam</span><strong>{currency(Number(form.annadaanamDonation) || 0)}</strong></div>
        <div className="summary-total"><span>Total</span><strong>{currency(total)}</strong></div>
        <button className="button primary full" disabled={busy || optimizing}>{optimizing ? "Optimizing image…" : busy ? "Saving…" : "Save Donation"}</button>
        <p>UPI only. Payment remains pending until an admin verifies it.</p>
      </aside>
    </form>
  );
}
