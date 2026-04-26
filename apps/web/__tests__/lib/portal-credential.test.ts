import { describe, it, expect } from "vitest";
import {
  portalAccountCreateSchema,
  portalCertificateCreateSchema,
} from "../../lib/validations/portal-credential";

describe("portalAccountCreateSchema", () => {
  it("accepts a valid payload for each portal", () => {
    for (const portal of ["HOMETAX", "MINWON24", "INSURANCE"] as const) {
      const result = portalAccountCreateSchema.safeParse({
        portal,
        userId: "user01",
        password: "secret",
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects unknown portal", () => {
    const result = portalAccountCreateSchema.safeParse({
      portal: "OTHER",
      userId: "u",
      password: "p",
    });
    expect(result.success).toBe(false);
  });

  it("rejects blank userId", () => {
    const result = portalAccountCreateSchema.safeParse({
      portal: "HOMETAX",
      userId: "   ",
      password: "p",
    });
    expect(result.success).toBe(false);
  });

  it("rejects blank password", () => {
    const result = portalAccountCreateSchema.safeParse({
      portal: "HOMETAX",
      userId: "u",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("portalCertificateCreateSchema", () => {
  it("accepts base64 + password", () => {
    const result = portalCertificateCreateSchema.safeParse({
      pfxBase64: "QUJDRA==",
      password: "x",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing pfx", () => {
    const result = portalCertificateCreateSchema.safeParse({
      pfxBase64: "",
      password: "x",
    });
    expect(result.success).toBe(false);
  });

  it("rejects oversized payload", () => {
    const result = portalCertificateCreateSchema.safeParse({
      pfxBase64: "a".repeat(6_000_001),
      password: "x",
    });
    expect(result.success).toBe(false);
  });
});
