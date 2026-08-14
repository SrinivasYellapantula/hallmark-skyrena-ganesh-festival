import { env } from "cloudflare:workers";
import { getAppUser } from "./auth";
import { FLOORS } from "./constants";

export async function isAdminRequest(request: Request) {
  return (await getAppUser(request))?.role === "admin";
}

export async function adminActor(request: Request) {
  return (await getAppUser(request))?.username ?? "unknown-admin";
}

export async function verifyTurnstile(request: Request, token?: string) {
  const secret = (env as unknown as Record<string, unknown>).TURNSTILE_SECRET;
  if (typeof secret !== "string" || !secret) return true;
  if (!token) return false;

  const body = new FormData();
  body.set("secret", secret);
  body.set("response", token);
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) body.set("remoteip", ip);

  const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  const payload = (await result.json()) as { success?: boolean };
  return payload.success === true;
}

export function cleanText(value: unknown, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalizeFlatNo(value: unknown, blockNo: unknown) {
  const flat = cleanText(value, 20).toUpperCase().replace(/[\s-]+/g, "");
  const block = cleanText(blockNo, 2).toUpperCase();
  if (block && flat.startsWith(block) && /^\d/.test(flat.slice(block.length))) {
    return flat.slice(block.length);
  }
  return flat;
}

export function isValidFlatNo(flatNo: unknown) {
  const flat = cleanText(flatNo, 20).toUpperCase();
  if (/^G\d{1,2}$/.test(flat)) return true;
  if (!/^\d{3,4}$/.test(flat)) return false;
  return (FLOORS as readonly string[]).includes(String(Number(flat.slice(0, -2))));
}

export function wholeNumber(value: unknown, minimum = 0, maximum = 1_000_000) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) return null;
  return number;
}
