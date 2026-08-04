import type { Metadata } from "next";
import { SiteHeader } from "../components/SiteChrome";
import { AdminDashboard } from "./AdminDashboard";

export const metadata: Metadata = { title: "Committee Console | Ganesh Festival 2026" };
export const dynamic = "force-dynamic";

export default function AdminPage() {
  return <main className="admin-page"><SiteHeader /><AdminDashboard /></main>;
}
