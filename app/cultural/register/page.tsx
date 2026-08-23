import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../components/SiteChrome";
import { CulturalRegistrationForm } from "./CulturalRegistrationForm";

export const metadata:Metadata={title:"Cultural Programme Registration | Hallmark Skyrena Ganesh Chaturthi 2026",description:"Register a solo or group cultural performance for Hallmark Skyrena Ganesh Chaturthi 2026."};
export default function CulturalRegistrationPage(){return <main><SiteHeader/><section className="page-intro wrap cultural-registration-intro"><div className="eyebrow"><span/>Ganesh Chaturthi 2026</div><h1>Cultural Programme Registration</h1><p>Register a solo or group performance. Residents can submit directly, and volunteers can use the same form while signed in.</p></section><CulturalRegistrationForm/><SiteFooter/></main>;}
