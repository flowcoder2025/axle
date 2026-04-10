import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
  getUnsubscribeUrl,
} from "../src/unsubscribe.js";

// ── Helpers ───────────────────────────────────────────────────────────────────
function stubSecret(secret = "test-secret-key") {
  vi.stubEnv("UNSUBSCRIBE_SECRET", secret);
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("generateUnsubscribeToken", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws when UNSUBSCRIBE_SECRET is missing", () => {
    expect(() => generateUnsubscribeToken("user@example.com")).toThrow(
      "UNSUBSCRIBE_SECRET"
    );
  });

  it("returns a 64-character hex string", () => {
    stubSecret();
    const token = generateUnsubscribeToken("user@example.com");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same email + secret", () => {
    stubSecret();
    const t1 = generateUnsubscribeToken("user@example.com");
    const t2 = generateUnsubscribeToken("user@example.com");
    expect(t1).toBe(t2);
  });

  it("normalises email to lowercase before hashing", () => {
    stubSecret();
    const lower = generateUnsubscribeToken("User@Example.COM");
    const upper = generateUnsubscribeToken("user@example.com");
    expect(lower).toBe(upper);
  });

  it("produces different tokens for different emails", () => {
    stubSecret();
    const t1 = generateUnsubscribeToken("a@example.com");
    const t2 = generateUnsubscribeToken("b@example.com");
    expect(t1).not.toBe(t2);
  });

  it("produces different tokens for different secrets", () => {
    vi.stubEnv("UNSUBSCRIBE_SECRET", "secret-A");
    const t1 = generateUnsubscribeToken("user@example.com");

    vi.stubEnv("UNSUBSCRIBE_SECRET", "secret-B");
    const t2 = generateUnsubscribeToken("user@example.com");

    expect(t1).not.toBe(t2);
  });
});

describe("verifyUnsubscribeToken", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true for a valid token", () => {
    stubSecret();
    const token = generateUnsubscribeToken("user@example.com");
    expect(verifyUnsubscribeToken("user@example.com", token)).toBe(true);
  });

  it("returns false for a tampered token", () => {
    stubSecret();
    const token = generateUnsubscribeToken("user@example.com");
    const tampered = token.slice(0, -2) + "ff";
    expect(verifyUnsubscribeToken("user@example.com", tampered)).toBe(false);
  });

  it("returns false for a different email with same token", () => {
    stubSecret();
    const token = generateUnsubscribeToken("user@example.com");
    expect(verifyUnsubscribeToken("other@example.com", token)).toBe(false);
  });

  it("returns false for a completely invalid token string", () => {
    stubSecret();
    expect(verifyUnsubscribeToken("user@example.com", "not-a-valid-hex-token")).toBe(false);
  });

  it("returns false when secret is missing", () => {
    // No UNSUBSCRIBE_SECRET set — generateUnsubscribeToken will throw,
    // verifyUnsubscribeToken should catch and return false
    expect(verifyUnsubscribeToken("user@example.com", "abc123")).toBe(false);
  });
});

describe("getUnsubscribeUrl", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    stubSecret();
  });

  it("builds a URL with email and token params", () => {
    const url = getUnsubscribeUrl("user@example.com", "https://axle.app");
    const parsed = new URL(url);

    expect(parsed.origin).toBe("https://axle.app");
    expect(parsed.pathname).toBe("/unsubscribe");
    expect(parsed.searchParams.get("email")).toBe("user@example.com");
    expect(parsed.searchParams.get("token")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates a URL whose token passes verification", () => {
    const url = getUnsubscribeUrl("user@example.com", "https://axle.app");
    const parsed = new URL(url);
    const email = parsed.searchParams.get("email")!;
    const token = parsed.searchParams.get("token")!;

    expect(verifyUnsubscribeToken(email, token)).toBe(true);
  });

  it("uses NEXT_PUBLIC_APP_URL when baseUrl is not provided", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://env.axle.app");
    const url = getUnsubscribeUrl("user@example.com");
    expect(url).toContain("https://env.axle.app/unsubscribe");
  });

  it("uses APP_URL as fallback", () => {
    vi.stubEnv("APP_URL", "https://app.axle.app");
    const url = getUnsubscribeUrl("user@example.com");
    expect(url).toContain("https://app.axle.app/unsubscribe");
  });

  it("throws when no baseUrl and no env var is set", () => {
    expect(() => getUnsubscribeUrl("user@example.com")).toThrow(
      "baseUrl is required"
    );
  });
});
