"use client";
/* eslint-disable @next/next/no-img-element -- static public asset is required by the Cloudflare Worker build */

import Link from "next/link";
import { useEffect, useState } from "react";

type User = { displayName: string; username: string; role: "admin" | "block" | "cultural"; blockNo: string | null };

export function SiteHeader() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => { fetch("/api/auth/me").then((response) => response.ok ? response.json() : null).then(setUser); }, []);
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); window.location.reload(); }
  return <header className="site-header"><div className="wrap nav-wrap">
    <Link className="brand" href="/"><img className="brand-logo" src="/skyrena-logo.png" alt="Hallmark Skyrena" width="318" height="225"/><span className="brand-copy"><small>Ganesh Chaturthi 2026</small></span></Link>
    {user && <nav aria-label="Primary navigation">
      {user.role !== "cultural" && <><Link href="/contribute">New Donation</Link><Link href="/donations">Donations</Link><Link href="/pending">Pending Flats</Link></>}
      {(user.role === "admin" || user.role === "cultural") && <Link href="/cultural">Cultural Programme</Link>}
      {user.role === "admin" && <><Link href="/admin">Festival Accounts</Link><Link href="/admin#expenses">Expenses</Link><Link href="/meetings">Meeting Minutes</Link><Link className="admin-link" href="/admin/users">User Access</Link></>}
      <span className="user-chip" title={user.username}>{user.role === "block" ? `Block ${user.blockNo} Coordinator` : user.role === "cultural" ? "Cultural Committee" : "Portal Administrator"}</span>
      <button className="logout-link" onClick={() => void logout()}>Sign out</button>
    </nav>}
  </div></header>;
}

export function SiteFooter() {
  return <footer className="site-footer"><div className="wrap footer-grid"><div><strong>Hallmark Skyrena</strong><p>Ganesh Chaturthi 2026 · Restricted committee workspace.</p></div><div><p>Role-scoped access</p><span>Each coordinator sees only the workspace assigned to their role.</span></div><div><p>Private committee records</p><span>Payment proofs and internal records are available only to authorized users.</span></div></div></footer>;
}
