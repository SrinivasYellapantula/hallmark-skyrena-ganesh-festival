import type { Metadata } from "next";
import { ContributionForm } from "./ContributionForm";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

export const metadata: Metadata = {
  title: "Donation Form | Hallmark Skyrena Ganesh Chaturthi 2026",
  description: "Submit a resident donation for Hallmark Skyrena Ganesh Chaturthi 2026.",
};

export default function ContributePage() {
  return (
    <main>
      <SiteHeader />
      <section className="page-intro wrap donation-intro">
        <h1>Donation Form</h1>
        <p>Submit household details, contributions, UPI payment proof and Lunch Mahaprasadam attendance. No login is required for residents.</p>
      </section>
      <ContributionForm />
      <SiteFooter />
    </main>
  );
}
