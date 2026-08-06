import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { MeetingMinutes } from "./MeetingMinutes";

export const metadata: Metadata = { title: "Meeting Minutes | Hallmark Skyrena Ganesh Chaturthi 2026" };
export default function MeetingsPage(){return <main className="meetings-page"><SiteHeader/><MeetingMinutes/><SiteFooter/></main>;}
