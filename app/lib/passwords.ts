import { createHash, pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";

const PASSWORD_ITERATIONS = 120_000;

function derivePassword(password: string, salt: Buffer, length = 32) {
  return new Promise<Buffer>((resolve, reject) => {
    pbkdf2(password, salt, PASSWORD_ITERATIONS, length, "sha256", (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}

export function normalizeUsername(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function validUsername(username: string) {
  return /^[a-z0-9_.-]{3,40}$/.test(username);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await derivePassword(password, salt);
  return { salt: salt.toString("base64"), hash: hash.toString("base64") };
}

export async function verifyPassword(password: string, salt: string, expectedHash: string) {
  const saltBytes = Buffer.from(salt, "base64");
  const expected = Buffer.from(expectedHash, "base64");
  if (saltBytes.length !== 16 || expected.length !== 32) return false;
  const actual = await derivePassword(password, saltBytes, expected.length);
  return timingSafeEqual(actual, expected);
}

export function newSessionToken() {
  return randomBytes(32).toString("base64url");
}

export async function hashSessionToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
