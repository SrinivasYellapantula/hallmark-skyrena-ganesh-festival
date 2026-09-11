import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { PoojaRegistrationForm } from "./PoojaRegistrationForm";

export const metadata:Metadata={title:"Pooja Registration | Hallmark Skyrena Ganesh Chaturthi 2026",description:"Register your household for the Ganesh Chaturthi 2026 Poojas."};
export default function PoojaRegistrationPage(){return <main><SiteHeader/><PoojaRegistrationForm/><SiteFooter/></main>;}
