// Data API key minting/verification. Server-only: never import from components.
import { createHash, randomBytes, timingSafeEqual } from "crypto";

export const KEY_PREFIX = "smk_live_";

export function mintApiKey(): { key: string; prefix: string; hash: string } {
  const body = randomBytes(24).toString("base64url");
  const key = `${KEY_PREFIX}${body}`;
  return { key, prefix: key.slice(0, KEY_PREFIX.length + 8), hash: hashApiKey(key) };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
