import { describe, it, expect } from "vitest";
import { redactCredentials, sentryBeforeSend } from "../../lib/log-sanitizer";

describe("log-sanitizer", () => {
  it("redacts top-level sensitive fields", () => {
    const out = redactCredentials({
      userId: "u_123",
      password: "secret",
      certPassword: "another",
      pfxBase64: "MII...",
      orgId: "o_456",
    });
    expect(out).toEqual({
      userId: "u_123",
      password: "[REDACTED]",
      certPassword: "[REDACTED]",
      pfxBase64: "[REDACTED]",
      orgId: "o_456",
    });
  });

  it("redacts case-insensitively", () => {
    const out = redactCredentials({
      Password: "pw",
      PFXBASE64: "x",
      Authorization: "Bearer abc",
    });
    expect(out).toEqual({
      Password: "[REDACTED]",
      PFXBASE64: "[REDACTED]",
      Authorization: "[REDACTED]",
    });
  });

  it("walks nested objects and arrays", () => {
    const out = redactCredentials({
      job: {
        id: "j1",
        credentials: {
          method: "certificate",
          pfxBase64: "secret-blob",
          certPassword: "p@ssw0rd",
        },
      },
      logs: [{ password: "x" }, { msg: "ok" }],
    });
    expect(out).toEqual({
      job: {
        id: "j1",
        credentials: {
          method: "certificate",
          pfxBase64: "[REDACTED]",
          certPassword: "[REDACTED]",
        },
      },
      logs: [{ password: "[REDACTED]" }, { msg: "ok" }],
    });
  });

  it("keeps non-sensitive values intact (numbers/null/booleans/dates)", () => {
    const dt = new Date("2026-04-26T00:00:00Z");
    const out = redactCredentials({
      count: 42,
      enabled: true,
      missing: null,
      when: dt,
      empty: undefined,
    });
    expect(out).toEqual({
      count: 42,
      enabled: true,
      missing: null,
      when: dt,
      empty: undefined,
    });
  });

  it("partially redacts tokenHash (first 8 chars + …[REDACTED])", () => {
    const out = redactCredentials({ tokenHash: "abcd1234efghijklmnop" });
    expect(out.tokenHash).toBe("abcd1234…[REDACTED]");
  });

  it("treats short tokenHash as fully redacted", () => {
    const out = redactCredentials({ tokenHash: "short" });
    expect(out.tokenHash).toBe("[REDACTED]");
  });

  it("redacts Uint8Array binary blobs", () => {
    const out = redactCredentials({
      pfx: new Uint8Array([0x30, 0x82, 0x04]),
      txt: "ok",
    });
    expect(out.pfx).toBe("[REDACTED]");
    expect(out.txt).toBe("ok");
  });

  it("does not mutate the original input", () => {
    const orig = { password: "pw" };
    redactCredentials(orig);
    expect(orig.password).toBe("pw");
  });

  it("sentryBeforeSend returns a sanitized event copy", () => {
    const event = {
      request: {
        headers: { Authorization: "Bearer t", cookie: "sid=x" },
        data: { password: "pw" },
      },
      tags: { orgId: "o_1" },
    } as const;
    const sanitized = sentryBeforeSend(event as unknown as Record<string, unknown>) as {
      request: { headers: Record<string, string>; data: Record<string, string> };
      tags: { orgId: string };
    };
    expect(sanitized.request.headers.Authorization).toBe("[REDACTED]");
    expect(sanitized.request.headers.cookie).toBe("[REDACTED]");
    expect(sanitized.request.data.password).toBe("[REDACTED]");
    expect(sanitized.tags.orgId).toBe("o_1");
  });

  it("respects max depth (does not blow up on cycles)", () => {
    const a: Record<string, unknown> = { name: "a", password: "p" };
    const b: Record<string, unknown> = { name: "b", a };
    a.b = b; // cycle
    expect(() => redactCredentials(a)).not.toThrow();
  });
});
