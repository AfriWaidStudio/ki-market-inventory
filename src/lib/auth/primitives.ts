import { argon2idAsync } from "@noble/hashes/argon2.js";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function normalizeEmail(email: string) { return email.trim().toLowerCase(); }
export function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function newOpaqueToken(bytes = 32) { return randomBytes(bytes).toString("base64url"); }
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const digest = await argon2idAsync(password, salt, { m: 19456, t: 2, p: 1, dkLen: 32 });
  return `$argon2id$v=19$m=19456,t=2,p=1$${salt.toString("base64url")}$${Buffer.from(digest).toString("base64url")}`;
}
export async function verifyPassword(passwordHash: string, password: string) {
  try {
    const parts = passwordHash.split("$");
    if (parts.length !== 6 || parts[1] !== "argon2id") return false;
    const salt = Buffer.from(parts[4], "base64url"); const expected = Buffer.from(parts[5], "base64url");
    const actual = Buffer.from(await argon2idAsync(password, salt, { m: 19456, t: 2, p: 1, dkLen: 32 }));
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch { return false; }
}
