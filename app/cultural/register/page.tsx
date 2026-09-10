import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../components/SiteChrome";
import { CulturalRegistrationForm } from "./CulturalRegistrationForm";

export const metadata:Metadata={title:"Cultural Programme Registration | Hallmark Skyrena Ganesh Chaturthi 2026",description:"Register a solo or group cultural performance for Hallmark Skyrena Ganesh Chaturthi 2026."};
export default async function CulturalRegistrationPage({searchParams}:{searchParams:Promise<{edit?:string;programme?:string}>}){const params=await searchParams;return <main><SiteHeader/><section className="page-intro wrap cultural-registration-intro"><div className="eyebrow"><span/>Ganesh Chaturthi 2026</div><h1>{params.edit||params.programme?"Edit Cultural Registration":"Cultural Programme Registration"}</h1><p>{params.edit||params.programme?"Correct or update the performance details below.":"View the current registration status. Signed-in committee members can continue managing programme entries."}</p></section><CulturalRegistrationForm editToken={params.edit} editId={params.programme}/><SiteFooter/></main>;}
