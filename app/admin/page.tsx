import type { Metadata } from "next";
import { SiteHeader } from "../components/SiteChrome";
import { AdminDashboard } from "./AdminDashboard";

export const metadata: Metadata = { title: "Festival Accounts | Hallmark Skyrena Ganesh Chaturthi 2026" };
export const dynamic = "force-dynamic";

export default function AdminPage() {
  return <main className="admin-page"><SiteHeader /><AdminDashboard /></main>;
}
