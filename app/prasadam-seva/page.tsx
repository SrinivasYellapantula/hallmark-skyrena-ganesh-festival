import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { PrasadamSevaForm } from "./PrasadamSevaForm";

export const metadata: Metadata = {
  title: "Daily Prasadam Seva | Hallmark Skyrena Ganesh Chaturthi 2026",
  description: "Register a voluntary daily prasadam offering for Hallmark Skyrena Ganesh Chaturthi 2026.",
};

export default function PrasadamSevaPage() {
  return <main><SiteHeader/><PrasadamSevaForm/><SiteFooter/></main>;
}
