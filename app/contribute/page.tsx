import type { Metadata } from "next";
import { ContributionForm } from "./ContributionForm";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

export const metadata: Metadata = {
  title: "New Donation | Hallmark Skyrena Ganesh Chaturthi 2026",
  description: "Record a resident donation for Hallmark Skyrena Ganesh Chaturthi 2026.",
};

export default function ContributePage() {
  return (
    <main>
      <SiteHeader />
      <section className="page-intro wrap donation-intro">
        <h1>New Donation</h1>
        <p>Record household details, contributions, UPI payment proof and Lunch Mahaprasadam attendance.</p>
      </section>
      <ContributionForm />
      <SiteFooter />
    </main>
  );
}
