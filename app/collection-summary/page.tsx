import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { CollectionSummary } from "./CollectionSummary";

export const metadata: Metadata = { title: "Collection Summary | Hallmark Skyrena Ganesh Chaturthi 2026" };

export default function CollectionSummaryPage() {
  return <main><SiteHeader /><CollectionSummary /><SiteFooter /></main>;
}
