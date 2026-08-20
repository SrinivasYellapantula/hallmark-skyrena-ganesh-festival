import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { ExpensesDashboard } from "./ExpensesDashboard";

export const metadata: Metadata = { title: "Festival Expenses | Hallmark Skyrena Ganesh Chaturthi 2026" };
export const dynamic = "force-dynamic";

export default function ExpensesPage() {
  return <main><SiteHeader /><ExpensesDashboard /><SiteFooter /></main>;
}
