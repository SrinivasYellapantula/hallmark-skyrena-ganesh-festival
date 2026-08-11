"use client";
/* eslint-disable @next/next/no-img-element -- static public asset is required by the Cloudflare Worker build */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type User = { displayName: string; username: string; role: "admin" | "block" | "cultural"; blockNo: string | null; portalOwner?: boolean };

export function SiteHeader() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [navOpen, setNavOpen] = useState(false);
  const adminMenuRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => { fetch("/api/auth/me").then((response) => response.ok ? response.json() : null).then(setUser); }, []);
  useEffect(() => {
    function closeAdministrationMenu(event: PointerEvent) {
      const menu = adminMenuRef.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
    }
    document.addEventListener("pointerdown", closeAdministrationMenu);
    return () => document.removeEventListener("pointerdown", closeAdministrationMenu);
  }, []);
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); window.location.reload(); }
  return <header className="site-header"><div className="wrap nav-wrap">
    <Link className="brand" href="/"><img className="brand-logo" src="/skyrena-logo.png" alt="Hallmark Skyrena" width="318" height="225"/><span className="brand-copy"><small>Ganesh Chaturthi 2026</small></span></Link>
    {user === null && <Link className="committee-signin" href="/">Committee sign in</Link>}
    {user && <>
      <button className="nav-toggle" aria-expanded={navOpen} aria-controls="primary-navigation" onClick={() => setNavOpen((open) => !open)}><span aria-hidden="true">{navOpen ? "×" : "☰"}</span>{navOpen ? "Close" : "Menu"}</button>
      <nav id="primary-navigation" className={`site-nav ${navOpen ? "open" : ""}`} aria-label="Primary navigation">
        <div className="nav-destinations">
          {user.role !== "cultural" && <><Link onClick={() => setNavOpen(false)} href="/contribute">New Donation</Link><Link onClick={() => setNavOpen(false)} href="/donations">Donations</Link><Link onClick={() => setNavOpen(false)} href="/collection-summary">Collection Summary</Link><Link onClick={() => setNavOpen(false)} href="/flat-status">Flat Status</Link><Link onClick={() => setNavOpen(false)} href="/pending">Pending Flats</Link></>}
          {(user.role === "admin" || user.role === "cultural") && <Link onClick={() => setNavOpen(false)} href="/cultural">Cultural Programme</Link>}
          {user.role === "admin" && <details ref={adminMenuRef} className="admin-menu"><summary><span>Administration</span><svg className="admin-chevron" aria-hidden="true" viewBox="0 0 12 12"><path d="m2.25 4.25 3.75 3.5 3.75-3.5"/></svg></summary><div><Link onClick={() => setNavOpen(false)} href="/admin"><strong>Festival Accounts</strong><small>Collections and verification</small></Link><Link onClick={() => setNavOpen(false)} href="/admin#expenses"><strong>Expenses</strong><small>Expense register and receipts</small></Link><Link onClick={() => setNavOpen(false)} href="/meetings"><strong>Meeting Minutes</strong><small>Decisions and action items</small></Link>{user.portalOwner&&<Link onClick={() => setNavOpen(false)} href="/admin#recycle-bin"><strong>Recycle Bin</strong><small>Restore removed records</small></Link>}<Link onClick={() => setNavOpen(false)} href="/admin/users"><strong>User Access</strong><small>Roles and coordinators</small></Link></div></details>}
        </div>
        <div className="nav-account"><span className="user-chip" title={`${user.displayName} · ${user.username}`}>{user.role === "block" ? `Block ${user.blockNo}` : user.role === "cultural" ? "Cultural" : user.portalOwner ? "Portal Admin" : "Admin"}</span><button className="logout-link" onClick={() => void logout()}>Sign out</button></div>
      </nav>
    </>}
  </div></header>;
}

export function SiteFooter() {
  return <footer className="site-footer"><div className="wrap footer-grid"><div><strong>Hallmark Skyrena</strong><p>Ganesh Chaturthi 2026 · Community festival portal.</p></div><div><p>Secure committee access</p><span>Internal workspaces remain restricted to assigned committee members.</span></div><div><p>Private records</p><span>Payment proofs and detailed records are available only to authorized users.</span></div></div></footer>;
}
