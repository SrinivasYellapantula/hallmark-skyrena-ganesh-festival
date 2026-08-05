import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";

const PASSWORD_ITERATIONS = 120_000;

export function normalizeUsername(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function validUsername(username: string) {
  return /^[a-z0-9_.-]{3,40}$/.test(username);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, 32, "sha256");
  return { salt: salt.toString("base64"), hash: hash.toString("base64") };
}

export async function verifyPassword(password: string, salt: string, expectedHash: string) {
  try {
    const saltBytes = Buffer.from(salt, "base64");
    const expected = Buffer.from(expectedHash, "base64");
    if (saltBytes.length !== 16 || expected.length !== 32) return false;
    const actual = pbkdf2Sync(password, saltBytes, PASSWORD_ITERATIONS, expected.length, "sha256");
    return timingSafeEqual(actual, expected);
  } catch (error) {
    console.error("Password verification failed", error);
    return false;
  }
}

export function newSessionToken() {
  return randomBytes(32).toString("base64url");
}

export async function hashSessionToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
