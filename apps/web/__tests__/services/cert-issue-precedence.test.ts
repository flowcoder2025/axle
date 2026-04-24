/**
 * WI-335-fix H1: Certificate issuance precedence between the two paths
 * (auto-on-COMPLETED vs. checklist-upload).
 *
 * Reviewer flagged this as a HIGH risk because subjectName is sourced from
 * different fields in each path. These tests pin the documented precedence:
 *   - Both sequences (auto→upload, upload→auto) end with EXACTLY ONE active
 *     Certificate whose subjectName is the user-supplied value.
 *   - The auto path is silently skipped when a valid cert already exists.
 *   - The upload path always supersedes the auto-created row.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockCertFindFirst, mockCertCreate, mockCertUpdateMany, mockChecklistItem } =
  vi.hoisted(() => ({
    mockCertFindFirst: vi.fn(),
    mockCertCreate: vi.fn(),
    mockCertUpdateMany: vi.fn(),
    mockChecklistItem: { findUnique: vi.fn(), update: vi.fn() },
  }));

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    certificate: {
      findFirst: mockCertFindFirst,
      create: mockCertCreate,
      updateMany: mockCertUpdateMany,
    },
    checklistItem: mockChecklistItem,
  },
}));

import { autoCreateCertificateFromProject } from "@/lib/services/project-certificate-auto";
import { fulfillCertificateUpload } from "@/lib/services/certificate-checklist";

const PROJECT = {
  id: "proj-1",
  type: "VENTURE_CERT" as const,
  clientId: "client-1",
  title: "JET 벤처기업 인증 신청",
};

beforeEach(() => {
  mockCertFindFirst.mockReset();
  mockCertCreate.mockReset();
  mockCertUpdateMany.mockReset();
  mockChecklistItem.findUnique.mockReset();
  mockChecklistItem.update.mockReset();

  mockCertUpdateMany.mockResolvedValue({ count: 0 });
  mockChecklistItem.update.mockResolvedValue({ id: "ci-1" });
});

describe("Cert issuance precedence — auto then upload", () => {
  it("creates auto cert with project.title, then upload supersedes it with user subjectName", async () => {
    // Step 1: project COMPLETED, no existing cert → auto-create
    mockCertFindFirst.mockResolvedValueOnce(null); // findValidCertificate
    mockCertCreate.mockResolvedValueOnce({ id: "cert-auto" });

    const autoResult = await autoCreateCertificateFromProject(PROJECT);
    expect(autoResult.created).toBe(true);
    expect(mockCertCreate.mock.calls[0][0].data.subjectName).toBe(PROJECT.title);

    // Step 2: consultant uploads PDF → fulfillCertificateUpload
    mockChecklistItem.findUnique.mockResolvedValueOnce({
      certificateType: "벤처기업확인서",
      certificateId: null,
    });
    mockCertCreate.mockResolvedValueOnce({ id: "cert-uploaded" });

    await fulfillCertificateUpload("ci-1", PROJECT.clientId, {
      subjectName: "벤처기업확인서_2026-04-24.pdf",
      storagePath: "/uploads/cert.pdf",
    });

    // Auto cert was deactivated by updateMany before the new row was inserted
    expect(mockCertUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientId: PROJECT.clientId, type: "벤처기업확인서", isActive: true },
        data: { isActive: false },
      }),
    );
    // Final active row uses the user-supplied subjectName
    const lastCreate = mockCertCreate.mock.calls.at(-1)![0];
    expect(lastCreate.data.subjectName).toBe("벤처기업확인서_2026-04-24.pdf");
    expect(lastCreate.data.isActive).toBe(true);
  });
});

describe("Cert issuance precedence — upload then auto (COMPLETED)", () => {
  it("upload creates active cert; subsequent COMPLETED is no-op (idempotent)", async () => {
    // Step 1: consultant uploads first
    mockChecklistItem.findUnique.mockResolvedValueOnce({
      certificateType: "벤처기업확인서",
      certificateId: null,
    });
    mockCertCreate.mockResolvedValueOnce({ id: "cert-uploaded" });

    await fulfillCertificateUpload("ci-1", PROJECT.clientId, {
      subjectName: "사용자 입력 인증서명",
      storagePath: "/uploads/cert.pdf",
    });
    expect(mockCertCreate.mock.calls[0][0].data.subjectName).toBe("사용자 입력 인증서명");

    // Step 2: project transitions to COMPLETED → autoCreate finds the upload
    mockCertFindFirst.mockResolvedValueOnce({
      id: "cert-uploaded",
      validTo: new Date("2030-01-01"),
    });

    const autoResult = await autoCreateCertificateFromProject(PROJECT);
    expect(autoResult.created).toBe(false);
    expect(autoResult.reason).toBe("ALREADY_EXISTS");
    expect(autoResult.certificateId).toBe("cert-uploaded");
    // Auto path did NOT call create — upload's row stays as the only active one
    expect(mockCertCreate).toHaveBeenCalledTimes(1);
  });
});

describe("Cert issuance precedence — both sequences converge", () => {
  it("end-state is identical regardless of order: user subjectName + 1 active row", async () => {
    // Sequence A: auto → upload
    mockCertFindFirst.mockResolvedValueOnce(null);
    mockCertCreate.mockResolvedValueOnce({ id: "a-auto" });
    await autoCreateCertificateFromProject(PROJECT);

    mockChecklistItem.findUnique.mockResolvedValueOnce({
      certificateType: "벤처기업확인서",
      certificateId: null,
    });
    mockCertCreate.mockResolvedValueOnce({ id: "a-upload" });
    await fulfillCertificateUpload("ci-A", PROJECT.clientId, {
      subjectName: "user.pdf",
      storagePath: "/uploads/A.pdf",
    });
    const sequenceASubject = mockCertCreate.mock.calls.at(-1)![0].data.subjectName;
    const sequenceADeactivated = mockCertUpdateMany.mock.calls.length;

    // Reset and run Sequence B: upload → auto
    mockCertFindFirst.mockReset();
    mockCertCreate.mockReset();
    mockCertUpdateMany.mockReset();
    mockChecklistItem.findUnique.mockReset();
    mockCertUpdateMany.mockResolvedValue({ count: 0 });

    mockChecklistItem.findUnique.mockResolvedValueOnce({
      certificateType: "벤처기업확인서",
      certificateId: null,
    });
    mockCertCreate.mockResolvedValueOnce({ id: "b-upload" });
    await fulfillCertificateUpload("ci-B", PROJECT.clientId, {
      subjectName: "user.pdf",
      storagePath: "/uploads/B.pdf",
    });

    mockCertFindFirst.mockResolvedValueOnce({
      id: "b-upload",
      validTo: new Date("2030-01-01"),
    });
    await autoCreateCertificateFromProject(PROJECT);

    const sequenceBSubject = mockCertCreate.mock.calls[0][0].data.subjectName;

    // Both sequences end with the user-supplied subjectName.
    expect(sequenceASubject).toBe("user.pdf");
    expect(sequenceBSubject).toBe("user.pdf");
    // Sequence A deactivated the auto row (1 updateMany call); B never had to.
    expect(sequenceADeactivated).toBe(1);
  });
});
