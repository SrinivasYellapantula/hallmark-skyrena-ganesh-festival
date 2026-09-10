import { BLOCKS } from "./constants";

export const PRASADAM_SEVA_DAYS = [
  { day: 1, date: "2026-09-14", block: "C", label: "Block C Seva Day" },
  { day: 2, date: "2026-09-15", block: "D", label: "Block D Seva Day" },
  { day: 3, date: "2026-09-16", block: "E", label: "Block E Seva Day" },
  { day: 4, date: "2026-09-17", block: "A", label: "Block A Seva Day" },
  { day: 5, date: "2026-09-18", block: "B", label: "Block B Seva Day" },
  { day: 6, date: "2026-09-19", block: "OPEN", label: "Open Offering" },
] as const;

export type PrasadamBlock = (typeof BLOCKS)[number];

export function eligiblePrasadamDays(block: string) {
  const normalized = block.trim().toUpperCase();
  return PRASADAM_SEVA_DAYS.filter((item) => item.block === normalized || item.block === "OPEN");
}

export function prasadamDateLabel(date: string) {
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${date}T12:00:00+05:30`));
}

export function isPrasadamDateAllowed(block: string, date: string) {
  return eligiblePrasadamDays(block).some((item) => item.date === date);
}
