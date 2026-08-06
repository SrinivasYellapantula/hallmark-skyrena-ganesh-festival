import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { CulturalProgramme } from "./CulturalProgramme";

export const metadata: Metadata = { title: "Cultural Programme | Hallmark Skyrena Ganesh Chaturthi 2026" };
export default function CulturalPage() { return <main><SiteHeader /><CulturalProgramme /><SiteFooter /></main>; }
