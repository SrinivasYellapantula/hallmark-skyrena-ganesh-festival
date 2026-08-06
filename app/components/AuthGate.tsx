"use client";
/* eslint-disable @next/next/no-img-element -- static public asset is required by the Cloudflare Worker build */

import { FormEvent, useEffect, useState } from "react";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "allowed" | "login">("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) { setState("login"); return; }
        const user = await response.json() as { role: "admin" | "block" | "cultural" };
        const path = window.location.pathname;
        const adminOnly = path.startsWith("/admin") || path.startsWith("/meetings");
        const culturalOnly = path.startsWith("/cultural");
        if (user.role === "cultural" && !culturalOnly) { window.location.replace("/cultural"); return; }
        if (user.role === "block" && (adminOnly || culturalOnly)) { window.location.replace("/"); return; }
        setState("allowed");
      })
      .catch(() => setState("login"));
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to sign in.");
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in.");
      setBusy(false);
    }
  }

  if (state === "loading") return <main className="auth-state"><img className="login-logo" src="/skyrena-logo.png" alt="Hallmark Skyrena" width="318" height="225"/><h1>Loading portal…</h1></main>;
  if (state === "login") return <main className="login-page">
    <section className="login-card">
      <img className="login-logo" src="/skyrena-logo.png" alt="Hallmark Skyrena" width="318" height="225"/>
      <span className="card-kicker">Restricted committee portal</span>
      <h1>Welcome back</h1>
      <p>Sign in with the username and password provided by the festival administrator.</p>
      <form onSubmit={login}>
        <label>Username<input name="username" required autoCapitalize="none" autoCorrect="off" autoComplete="username" /></label>
        <label>Password<input name="password" type="password" required autoComplete="current-password" /></label>
        {error && <p className="form-error">{error}</p>}
        <button className="button primary full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      <small>Forgot your password? Contact the portal administrator.</small>
    </section>
    <aside className="login-art"><div className="login-disc"><strong>Ganesh<br />Chaturthi</strong><span>Hallmark Skyrena · 2026</span></div></aside>
  </main>;
  return <>{children}</>;
}
