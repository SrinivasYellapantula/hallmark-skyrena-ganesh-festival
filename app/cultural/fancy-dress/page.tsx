import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../components/SiteChrome";
import { FancyDressRegistrationForm } from "./FancyDressRegistrationForm";

export const metadata:Metadata={title:"Fancy Dress Registration | Hallmark Skyrena Ganesh Chaturthi 2026",description:"Register for the Hallmark Skyrena Fancy Dress programme on 17 September 2026."};

export default function FancyDressPage(){return <main><SiteHeader/><section className="page-intro wrap fancy-dress-intro"><div><div className="eyebrow"><span/>Cultural Programme</div><h1>Fancy Dress Registration</h1><p>Register a participant for our community Fancy Dress programme.</p></div><aside><span>Programme</span><strong>17 September 2026</strong><b>7:00 PM onwards</b><small>Registration closes 13 September 2026</small></aside></section><FancyDressRegistrationForm/><SiteFooter/></main>;}
