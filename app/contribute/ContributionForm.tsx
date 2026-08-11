"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BLOCKS, MINIMUM_DONATION, currency } from "../lib/constants";
import { optimizeImageUpload } from "../lib/client-image";

type User = { role: "admin" | "block"; blockNo: string | null };
type Success = { referenceNo: string };
type MasterFlat = { flatNo: string; residentName?: string; occupancy?: string; donated?: number };

const blank = {
  residentName: "",
  blockNo: "",
  floorNo: "",
  flatNo: "",
  gotram: "",
  occupancy: "",
  phone: "",
  mainDonation: "0",
  idolDonation: "0",
  annadaanamDonation: "0",
  adultCount: "0",
  childCount: "0",
  paymentReference: "",
};
const ATTENDANCE_OPTIONS = Array.from({ length: 8 }, (_, index) => String(index));
const FLOOR_OPTIONS = ["G", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "14", "15"];
export function ContributionForm() {
  const [form, setForm] = useState(blank);
  const [user, setUser] = useState<User | null>(null);
  const [accessChecked, setAccessChecked] = useState(false);
  const [proof, setProof] = useState<File | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<Success | null>(null);
  const [masterFlats, setMasterFlats] = useState<MasterFlat[]>([]);
  const [flatsLoading, setFlatsLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) return null;
        if (!response.ok) throw new Error("Unable to check committee access.");
        return response.json() as Promise<User>;
      })
      .then((profile) => {
        if (!profile) return;
        setUser(profile);
        if (profile.role === "block") {
          setFlatsLoading(Boolean(profile.blockNo));
          setForm((current) => ({ ...current, blockNo: profile.blockNo ?? "" }));
        }
      })
      .catch(() => setError("Unable to check committee access. You can still complete the resident donation form."))
      .finally(() => setAccessChecked(true));
  }, []);

  useEffect(() => {
    if (!accessChecked || !user || !form.blockNo) return;
    let active = true;
    fetch(`/api/flats/map?block=${form.blockNo}`, { cache: "no-store" })
      .then(async (response) => ({ response, payload: await response.json() }))
      .then(({ response, payload }) => {
        if (!active) return;
        if (!response.ok) throw new Error(payload.error ?? "Unable to load occupied flats.");
        setMasterFlats(payload.flats ?? []);
      })
      .catch((caught) => active && setError(caught instanceof Error ? caught.message : "Unable to load occupied flats."))
      .finally(() => active && setFlatsLoading(false));
    return () => { active = false; };
  }, [accessChecked, form.blockNo, user]);

  const total = useMemo(
    () => Number(form.mainDonation || 0) + Number(form.idolDonation || 0) + Number(form.annadaanamDonation || 0),
    [form.mainDonation, form.idolDonation, form.annadaanamDonation],
  );

  function update(name: string, value: string) {
    if (name === "blockNo") { setMasterFlats([]); setFlatsLoading(Boolean(value) && Boolean(user)); }
    setForm((current) => {
      if (name === "blockNo") return { ...current, blockNo: value, floorNo: "", flatNo: "", residentName: "", occupancy: "" };
      if (name === "floorNo") return { ...current, floorNo: value, flatNo: "", residentName: "", occupancy: "" };
      if (name === "flatNo" && user) {
        const selectedFlat = masterFlats.find((flat) => flat.flatNo === value);
        return { ...current, flatNo: value, residentName: selectedFlat?.residentName || "", occupancy: selectedFlat?.occupancy || "" };
      }
      return { ...current, [name]: value };
    });
  }

  const floorFlats = useMemo(() => masterFlats.filter((flat) => flatFloor(flat.flatNo) === form.floorNo), [masterFlats, form.floorNo]);

  async function selectProof(file: File | null) {
    setProof(null);
    setError("");
    if (!file) return;
    setOptimizing(true);
    try {
      setProof(await optimizeImageUpload(file, "payment-proof"));
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
      setMasterFlats((current) => current.map((flat) => flat.flatNo === form.flatNo ? { ...flat, ...(user ? { residentName: form.residentName, occupancy: form.occupancy, donated: 1 } : {}) } : flat));
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

  if (!accessChecked) return <section className="wrap compact auth-state donation-form-loading"><h2>Loading donation form…</h2></section>;

  const isResident = !user;

  return (
    <form className="wrap form-shell" onSubmit={submit}>
      <div className="form-main">
        {isResident && <p className="resident-form-note"><strong>Resident self-entry:</strong> Submit your household and payment details here. Fields marked <span className="required-mark">*</span> are mandatory.</p>}
        <fieldset aria-labelledby="household-section-title">
          <div className="form-section-heading" id="household-section-title"><span>1</span><h2>Household Details</h2></div>
          <p className="fieldset-help">{isResident ? "Please enter your household details." : "All household details are mandatory."}</p>
          <div className="field-grid">
            <label>{isResident ? <span className="field-label">Block<span className="required-mark">*</span></span> : "Block"}
              <select required name="blockNo" disabled={user?.role === "block"} value={form.blockNo} onChange={(event) => update(event.target.name, event.target.value)}>
                <option value="">Select block</option>
                {BLOCKS.map((block) => <option key={block} value={block}>Block {block}</option>)}
              </select>
              {user?.role === "block" && <small>Locked to Block {user.blockNo}</small>}
            </label>
            {!isResident && <label>Floor
              <select required name="floorNo" value={form.floorNo} disabled={!form.blockNo || flatsLoading} onChange={(event) => update(event.target.name, event.target.value)}>
                <option value="">{flatsLoading ? "Loading floors…" : "Select floor"}</option>
                {FLOOR_OPTIONS.map((floor) => <option key={floor} value={floor}>Floor {floor}</option>)}
              </select>
            </label>}
            {isResident ? <label><span className="field-label">Flat Number<span className="required-mark">*</span></span>
              <input required name="flatNo" autoCapitalize="characters" maxLength={20} value={form.flatNo} onChange={(event) => update(event.target.name, event.target.value)} placeholder="e.g. G01 or 101" />
            </label> : <label className="wide">Flat Number
              <select required name="flatNo" value={form.flatNo} disabled={!form.floorNo || flatsLoading} onChange={(event) => update(event.target.name, event.target.value)}>
                <option value="">{!form.floorNo ? "Select block and floor first" : floorFlats.length ? "Select occupied flat" : "No occupied flats on this floor"}</option>
                {floorFlats.map((flat) => <option key={flat.flatNo} value={flat.flatNo}>{flat.flatNo}{user && flat.residentName ? ` — ${flat.residentName}` : ""}{user && flat.donated ? " — donation recorded" : ""}</option>)}
              </select>
              <small>The list comes from the occupied-flat master. The resident name entered below updates the master when this donation is saved.</small>
            </label>}
            <label className="wide">{isResident ? <span className="field-label">Resident Name<span className="required-mark">*</span></span> : "Resident Name"}
              <input required name="residentName" autoComplete="name" value={form.residentName} onChange={(event) => update(event.target.name, event.target.value)} />
              {user && <small>Prefilled from the flat master when available. Correcting it here updates the master after saving.</small>}
            </label>
            <label>{isResident ? <span className="field-label">Gotram<span className="required-mark">*</span></span> : "Gotram"}
              <input required name="gotram" value={form.gotram} onChange={(event) => update(event.target.name, event.target.value)} />
            </label>
            <label>{isResident ? <span className="field-label">Occupancy<span className="optional">optional</span></span> : "Occupancy"}
              <select required={!isResident} name="occupancy" value={form.occupancy} onChange={(event) => update(event.target.name, event.target.value)}>
                <option value="">{isResident ? "Prefer not to specify" : "Select occupancy"}</option>
                <option value="owner">Owner</option>
                <option value="tenant">Tenant</option>
              </select>
              {user && <small>Prefilled from the occupied-flat master when available.</small>}
            </label>
            <label className="wide">{isResident ? <span className="field-label">Phone No.<span className="required-mark">*</span></span> : "Phone No."}
              <input required name="phone" type="tel" inputMode="tel" autoComplete="tel" minLength={10} maxLength={15} value={form.phone} onChange={(event) => update(event.target.name, event.target.value)} />
            </label>
          </div>
        </fieldset>

        <fieldset aria-labelledby="contributions-section-title">
          <div className="form-section-heading" id="contributions-section-title"><span>2</span><h2>Contributions</h2></div>
          <div className="field-grid">
            <label>{isResident ? <span className="field-label">Donation Amount<span className="required-mark">*</span></span> : "Donation Amount"}
              <input required name="mainDonation" type="number" inputMode="numeric" min={MINIMUM_DONATION} step="1" value={form.mainDonation} onChange={(event) => update(event.target.name, event.target.value)} />
              <small>Voluntary contribution — enter any amount.</small>
            </label>
            <label>Idol Donation Amount
              <input name="idolDonation" type="number" inputMode="numeric" min="0" step="1" value={form.idolDonation} onChange={(event) => update(event.target.name, event.target.value)} />
              <small>Enter 0 when there is no separate idol contribution.</small>
            </label>
            <label className="wide">Mahaprasadam Donation Amount
              <input name="annadaanamDonation" type="number" inputMode="numeric" min="0" step="1" value={form.annadaanamDonation} onChange={(event) => update(event.target.name, event.target.value)} />
              <small>Enter 0 when there is no additional Mahaprasadam support.</small>
            </label>
            <section className="wide payment-qr-card" aria-labelledby="payment-qr-title">
              <div className="payment-qr-copy">
                <span className="card-kicker">Official festival UPI</span>
                <h3 id="payment-qr-title">Scan to make the resident’s payment</h3>
                <p>Use this QR code only for Hallmark Skyrena Ganesh Chaturthi 2026 contributions.</p>
                <small>On mobile, tap the payment poster to open it at full size. You can then share or save it if needed.</small>
              </div>
              <a href="/hallmark-skyrena-upi-qr.png" target="_blank" rel="noreferrer" aria-label="Open the official UPI payment QR code at full size">
                {/* Keep the original bank-issued QR pixels intact instead of routing it through an image optimizer. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/hallmark-skyrena-upi-qr.png" alt="Official Hallmark Skyrena cultural account UPI payment QR code" />
                <strong>Tap to view full size</strong>
              </a>
            </section>
            <label className="wide">UPI Transaction Reference No. <span className="optional">optional</span>
              <input name="paymentReference" value={form.paymentReference} onChange={(event) => update(event.target.name, event.target.value)} placeholder="UPI / UTR reference" />
            </label>
            <label className="wide proof-picker">{isResident ? <span className="field-label">Payment Confirmation Image<span className="required-mark">*</span></span> : "Payment Confirmation Image"}
              <input required type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => void selectProof(event.target.files?.[0] ?? null)} />
              <small>On mobile, choose Camera to photograph the confirmation. Large images are automatically compressed for private storage.</small>
              {optimizing && <strong>Optimizing image…</strong>}
              {proof && <strong>Ready: {proof.name} ({Math.ceil(proof.size / 1024)} KB)</strong>}
            </label>
          </div>
        </fieldset>

        <fieldset aria-labelledby="attendance-section-title">
          <div className="form-section-heading" id="attendance-section-title"><span>3</span><h2>Lunch Mahaprasadam Attendance</h2></div>
          <p className="mahaprasadam-note"><strong>Please note:</strong> Lunch Mahaprasadam will be served on the day of Visarjan.</p>
          <div className="field-grid">
            <label>{isResident ? <span className="field-label">No. of Adults<span className="required-mark">*</span></span> : "No. of Adults"}
              <select required name="adultCount" value={form.adultCount} onChange={(event) => update(event.target.name, event.target.value)}>
                {ATTENDANCE_OPTIONS.map((count) => <option key={count} value={count}>{count}</option>)}
              </select>
            </label>
            <label><span className="field-label">No. of Kids <span className="label-note">(below 10 yrs)</span>{isResident && <span className="required-mark"> *</span>}</span>
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
        <div><span>Idol donation</span><strong>{currency(Number(form.idolDonation) || 0)}</strong></div>
        <div><span>Mahaprasadam</span><strong>{currency(Number(form.annadaanamDonation) || 0)}</strong></div>
        <div className="summary-total"><span>Total</span><strong>{currency(total)}</strong></div>
        <button className="button primary full" disabled={busy || optimizing}>{optimizing ? "Optimizing image…" : busy ? "Saving…" : "Save Donation"}</button>
        <p>{isResident ? "UPI payments only." : "UPI only. Payment remains pending until an admin verifies it."}</p>
      </aside>
    </form>
  );
}

function flatFloor(flatNo: string) {
  const normalized = flatNo.trim().toUpperCase();
  if (normalized.startsWith("G")) return "G";
  const match = normalized.match(/(\d{3,4})$/);
  return match ? String(Number(match[1].slice(0, -2))) : "";
}
