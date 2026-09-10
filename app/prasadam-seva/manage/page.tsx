import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../components/SiteChrome";
import { PrasadamSevaDashboard } from "./PrasadamSevaDashboard";

export const metadata: Metadata = { title: "Prasadam Seva Plan | Hallmark Skyrena Ganesh Chaturthi 2026" };
export default function PrasadamSevaManagePage(){return <main><SiteHeader/><PrasadamSevaDashboard/><SiteFooter/></main>;}
