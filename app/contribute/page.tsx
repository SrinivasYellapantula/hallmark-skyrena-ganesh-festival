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
        <h1>New Donation</h1>
        <p>Record household details, contributions, UPI payment proof and Lunch Mahaprasadam attendance.</p>
      </section>
      <ContributionForm />
      <SiteFooter />
    </main>
  );
}
