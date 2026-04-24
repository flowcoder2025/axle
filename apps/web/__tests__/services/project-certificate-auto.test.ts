/**
 * Tests for WI-325 auto-certificate creation on project completion.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCertificate } = vi.hoisted(() => ({
  mockCertificate: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@axle/db", () => ({
  prisma: { certificate: mockCertificate },
}));

import {
  autoCreateCertificateFromProject,
  certificateTypeForProject,
} from "../../lib/services/project-certificate-auto";

const baseProject = {
  id: "proj-1",
  clientId: "client-1",
  title: "2026 벤처 신규 확인",
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("certificateTypeForProject", () => {
  it("returns known mapping for VENTURE_CERT", () => {
    expect(certificateTypeForProject("VENTURE_CERT")).toBe("벤처기업확인서");
  });

  it("returns known mapping for RESEARCH_INSTITUTE", () => {
    expect(certificateTypeForProject("RESEARCH_INSTITUTE")).toBe(
      "기업부설연구소 인정서",
    );
  });

  it("returns null for project types that don't produce a certificate", () => {
    expect(certificateTypeForProject("BUSINESS_PLAN")).toBeNull();
    expect(certificateTypeForProject("FINANCIAL_ANALYSIS")).toBeNull();
    expect(certificateTypeForProject("RESEARCH_TASK")).toBeNull();
  });
});

describe("autoCreateCertificateFromProject", () => {
  it("skips BUNDLE projects", async () => {
    const result = await autoCreateCertificateFromProject({
      ...baseProject,
      type: "BUNDLE",
    });
    expect(result).toEqual({
      created: false,
      certificateId: null,
      reason: "BUNDLE_SKIPPED",
    });
    expect(mockCertificate.create).not.toHaveBeenCalled();
  });

  it("skips project types with no certificate mapping", async () => {
    const result = await autoCreateCertificateFromProject({
      ...baseProject,
      type: "BUSINESS_PLAN",
    });
    expect(result).toEqual({
      created: false,
      certificateId: null,
      reason: "UNSUPPORTED_TYPE",
    });
    expect(mockCertificate.create).not.toHaveBeenCalled();
  });

  it("creates a VENTURE_CERT certificate with 3-year validity", async () => {
    mockCertificate.findFirst.mockResolvedValue(null);
    mockCertificate.create.mockResolvedValue({ id: "cert-new" });

    const issuedAt = new Date("2026-04-24T00:00:00Z");
    const result = await autoCreateCertificateFromProject(
      { ...baseProject, type: "VENTURE_CERT" },
      { issuedAt },
    );

    expect(result).toEqual({ created: true, certificateId: "cert-new" });
    expect(mockCertificate.create).toHaveBeenCalledWith({
      data: {
        clientId: "client-1",
        type: "벤처기업확인서",
        subjectName: baseProject.title,
        validFrom: issuedAt,
        validTo: new Date("2029-04-24T00:00:00Z"),
        isActive: true,
      },
      select: { id: true },
    });
  });

  it("stores null validTo for RESEARCH_INSTITUTE (no expiry)", async () => {
    mockCertificate.findFirst.mockResolvedValue(null);
    mockCertificate.create.mockResolvedValue({ id: "cert-ri" });

    await autoCreateCertificateFromProject({
      ...baseProject,
      type: "RESEARCH_INSTITUTE",
    });

    const [call] = mockCertificate.create.mock.calls;
    expect(call[0].data.type).toBe("기업부설연구소 인정서");
    expect(call[0].data.validTo).toBeNull();
  });

  it("is idempotent when a valid certificate already exists", async () => {
    mockCertificate.findFirst.mockResolvedValue({
      id: "cert-existing",
      validTo: new Date("2099-01-01"),
    });

    const result = await autoCreateCertificateFromProject({
      ...baseProject,
      type: "VENTURE_CERT",
    });

    expect(result).toEqual({
      created: false,
      certificateId: "cert-existing",
      reason: "ALREADY_EXISTS",
    });
    expect(mockCertificate.create).not.toHaveBeenCalled();
  });

  it("creates PATENT certificate with 20-year validity", async () => {
    mockCertificate.findFirst.mockResolvedValue(null);
    mockCertificate.create.mockResolvedValue({ id: "cert-patent" });

    const issuedAt = new Date("2026-01-15T00:00:00Z");
    await autoCreateCertificateFromProject(
      { ...baseProject, type: "PATENT" },
      { issuedAt },
    );

    const [call] = mockCertificate.create.mock.calls;
    expect(call[0].data.type).toBe("특허등록증");
    expect(call[0].data.validTo).toEqual(new Date("2046-01-15T00:00:00Z"));
  });
});
