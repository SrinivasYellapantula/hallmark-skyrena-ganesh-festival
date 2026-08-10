export const EVENT_ID = "ganesh-2026";
export const EVENT_YEAR = 2026;
export const MINIMUM_DONATION = 0;
export const BLOCKS = ["A", "B", "C", "D", "E"] as const;

export function currency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
