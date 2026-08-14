export const EVENT_ID = "ganesh-2026";
export const EVENT_YEAR = 2026;
export const MINIMUM_DONATION = 0;
export const BLOCKS = ["A", "B", "C", "D", "E"] as const;
export const FLOORS = ["G", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "14", "15"] as const;
export const FLATS_PER_FLOOR: Record<(typeof BLOCKS)[number], number> = { A: 10, B: 10, C: 6, D: 10, E: 10 };

export function isFlatNumberAllowed(flatNo: string, blockNo: string) {
  const flat = flatNo.trim().toUpperCase();
  const block = blockNo.trim().toUpperCase() as (typeof BLOCKS)[number];
  const maximumUnit = FLATS_PER_FLOOR[block];
  if (!maximumUnit) return false;
  if (/^G\d{1,2}$/.test(flat)) {
    const unit = Number(flat.slice(1));
    return unit >= 1 && unit <= maximumUnit;
  }
  if (!/^\d{3,4}$/.test(flat)) return false;
  const floor = String(Number(flat.slice(0, -2)));
  const unit = Number(flat.slice(-2));
  return (FLOORS as readonly string[]).includes(floor) && unit >= 1 && unit <= maximumUnit;
}

export function currency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
