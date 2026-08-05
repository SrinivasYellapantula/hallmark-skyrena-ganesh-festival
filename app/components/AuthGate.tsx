"use client";

import { FormEvent, useEffect, useState } from "react";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "allowed" | "login">("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => setState(response.ok ? "allowed" : "login"))
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

  if (state === "loading") return <main className="auth-state"><div className="brand-seal">श्री</div><h1>Loading portal…</h1></main>;
  if (state === "login") return <main className="login-page">
    <section className="login-card">
      <div className="brand-seal">श्री</div>
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
