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
        <div className="eyebrow"><span /> Household registration</div>
        <h1>Join the celebration.</h1>
        <p>One form records your contribution and helps the team plan Annadaanam accurately.</p>
      </section>
      <ContributionForm />
      <SiteFooter />
    </main>
  );
}
