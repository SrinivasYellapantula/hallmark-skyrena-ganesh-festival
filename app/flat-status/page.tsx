import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { FlatStatusMap } from "./FlatStatusMap";

export const metadata: Metadata = { title: "Flat Status Map | Hallmark Skyrena Ganesh Chaturthi 2026" };
export default function FlatStatusPage(){return <main><SiteHeader/><FlatStatusMap/><SiteFooter/></main>;}
