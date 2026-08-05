import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { TransparencyDashboard } from "./TransparencyDashboard";

export const metadata: Metadata = {
  title: "Transparent Accounts | Hallmark Skyrena Ganesh Chaturthi 2026",
  description: "Verified community collections, Annadaanam support and festival expenses.",
};

export default function TransparencyPage() {
  return <main><SiteHeader /><TransparencyDashboard /><SiteFooter /></main>;
}
