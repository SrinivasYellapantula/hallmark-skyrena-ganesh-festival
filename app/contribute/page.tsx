import type { Metadata } from "next";
import { ContributionForm } from "./ContributionForm";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

export const metadata: Metadata = {
  title: "Contribute | Hallmark Skyrena Ganesh Chaturthi 2026",
  description: "Register your household and record your Hallmark Skyrena Ganesh Chaturthi contribution.",
};

export default function ContributePage() {
  return (
    <main>
      <SiteHeader />
      <section className="page-intro wrap compact">
        <div className="eyebrow"><span /> Authorized collection entry</div>
        <h1>Record a donation.</h1>
        <p>Capture household details, UPI reference, payment confirmation and Annadaanam attendance.</p>
      </section>
      <ContributionForm />
      <SiteFooter />
    </main>
  );
}
