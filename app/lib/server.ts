import { env } from "cloudflare:workers";
import { getAppUser } from "./auth";

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

export function wholeNumber(value: unknown, minimum = 0, maximum = 1_000_000) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) return null;
  return number;
}
