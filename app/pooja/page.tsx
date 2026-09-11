import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { PoojaDashboard } from "./PoojaDashboard";
export const metadata:Metadata={title:"Pooja Registrations | Hallmark Skyrena Ganesh Chaturthi 2026"};
export default function PoojaPage(){return <main><SiteHeader/><PoojaDashboard/><SiteFooter/></main>;}
