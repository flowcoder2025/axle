import { describe, it, expect, vi } from "vitest";

vi.stubEnv("SCRAPER_CRED_MASTER_KEY", "b".repeat(64));

const {
  encryptCredential,
  decryptCredential,
  encryptCredentialBytes,
  decryptCredentialBytes,
} = await import("../../lib/scraper-crypto");

describe("scraper-crypto (string)", () => {
  it("round-trips a text credential", () => {
    const plaintext = "passw0rd!@#한글";
    const encrypted = encryptCredential(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decryptCredential(encrypted)).toBe(plaintext);
  });

  it("uses random IV — same plaintext produces different ciphertext", () => {
    const plaintext = "identical-input";
    const a = encryptCredential(plaintext);
    const b = encryptCredential(plaintext);
    expect(a).not.toBe(b);
    expect(decryptCredential(a)).toBe(plaintext);
    expect(decryptCredential(b)).toBe(plaintext);
  });

  it("detects tampering via auth tag", () => {
    const plaintext = "secret";
    const encrypted = encryptCredential(plaintext);
    const raw = Buffer.from(encrypted, "base64");
    // Flip a byte in the ciphertext portion (after iv + tag = 32 bytes)
    raw[35] ^= 0xff;
    const tampered = raw.toString("base64");
    expect(() => decryptCredential(tampered)).toThrow();
  });
});

describe("scraper-crypto (binary)", () => {
  it("round-trips a PFX-like binary blob", () => {
    const pfx = Buffer.from([0x30, 0x82, 0x04, 0xa1, 0xde, 0xad, 0xbe, 0xef]);
    const encrypted = encryptCredentialBytes(pfx);
    expect(typeof encrypted).toBe("string");
    const decrypted = decryptCredentialBytes(encrypted);
    expect(Buffer.compare(decrypted, pfx)).toBe(0);
  });

  it("handles 4KB blob", () => {
    const pfx = Buffer.alloc(4096);
    for (let i = 0; i < pfx.length; i++) pfx[i] = (i * 7) & 0xff;
    const encrypted = encryptCredentialBytes(pfx);
    const decrypted = decryptCredentialBytes(encrypted);
    expect(Buffer.compare(decrypted, pfx)).toBe(0);
  });
});

describe("scraper-crypto key validation", () => {
  it("rejects missing / malformed master key", async () => {
    vi.resetModules();
    vi.stubEnv("SCRAPER_CRED_MASTER_KEY", "short");
    const mod = await import("../../lib/scraper-crypto");
    expect(() => mod.encryptCredential("x")).toThrow(/SCRAPER_CRED_MASTER_KEY/);
    vi.stubEnv("SCRAPER_CRED_MASTER_KEY", "b".repeat(64));
    vi.resetModules();
  });
});
