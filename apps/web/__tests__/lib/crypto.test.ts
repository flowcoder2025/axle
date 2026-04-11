import { describe, it, expect, vi } from "vitest";

vi.stubEnv("OAUTH_ENCRYPTION_KEY", "a".repeat(64));

const { encrypt, decrypt } = await import("../../lib/crypto");

describe("crypto", () => {
  it("encrypts and decrypts a string", () => {
    const plaintext = "my-secret-token-value";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("produces different ciphertext each time (random IV)", () => {
    const plaintext = "same-input";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it("handles unicode strings", () => {
    const plaintext = "한글 토큰 값 with emoji 🔑";
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });
});
