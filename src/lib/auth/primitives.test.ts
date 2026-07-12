import { describe, expect, it } from "vitest";
import { hashPassword, hashToken, newOpaqueToken, normalizeEmail, verifyPassword } from "./primitives";

describe("auth primitives", () => {
  it("normalizes email addresses", () => expect(normalizeEmail(" Test@Example.COM ")).toBe("test@example.com"));
  it("hashes opaque tokens deterministically without storing the token", () => {
    expect(hashToken("secret")).toHaveLength(64); expect(hashToken("secret")).toBe(hashToken("secret"));
  });
  it("generates distinct high-entropy tokens", () => expect(newOpaqueToken()).not.toBe(newOpaqueToken()));
  it("hashes and verifies passwords with Argon2id", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(hash, "correct horse battery staple")).toBe(true);
    expect(await verifyPassword(hash, "incorrect password")).toBe(false);
  });
});
