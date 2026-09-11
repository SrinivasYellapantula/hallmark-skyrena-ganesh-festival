export const HOMAM_FEE = 2500;
export const HOMAM_CAPACITY = 10;
export const POOJA_TYPES = ["daily", "saraswathi", "lakshmi", "homam"] as const;
export type PoojaType = (typeof POOJA_TYPES)[number];
export const POOJA_LABELS: Record<PoojaType,string> = {
  daily:"Daily Pooja",saraswathi:"Saraswathi Pooja",lakshmi:"Lakshmi Pooja",homam:"Homam",
};
export const DAILY_POOJA_SLOTS = [
  {date:"2026-09-14",day:1,sessions:["evening"]},
  {date:"2026-09-15",day:2,sessions:["morning","evening"]},
  {date:"2026-09-16",day:3,sessions:["morning","evening"]},
  {date:"2026-09-17",day:4,sessions:["morning","evening"]},
  {date:"2026-09-18",day:5,sessions:["morning","evening"]},
  {date:"2026-09-19",day:6,sessions:["morning","evening"]},
] as const;
export function poojaDate(type:PoojaType){return type==="saraswathi"?"2026-09-16":type==="lakshmi"?"2026-09-18":type==="homam"?"2026-09-19":"";}
export function validDailySlot(date:string,session:string){return DAILY_POOJA_SLOTS.some((slot)=>slot.date===date&&(slot.sessions as readonly string[]).includes(session));}
export function poojaDateLabel(date:string){return new Date(`${date}T00:00:00+05:30`).toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short",year:"numeric"});}
