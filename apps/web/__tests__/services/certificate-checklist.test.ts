import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCertificate = {
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
};

const mockChecklistItem = {
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};

vi.mock("@axle/db", () => ({
  prisma: {
    certificate: mockCertificate,
    checklistItem: mockChecklistItem,
  },
}));

describe("certificate-checklist service", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("requestCertificate", () => {
    it("creates PENDING item when no valid certificate exists", async () => {
      mockChecklistItem.findFirst.mockResolvedValue(null);
      mockCertificate.findFirst.mockResolvedValue(null);
      mockChecklistItem.create.mockResolvedValue({
        id: "ci-1",
        itemType: "CERTIFICATE",
        certificateType: "벤처기업확인서",
        status: "PENDING",
      });

      const { requestCertificate } = await import(
        "../../lib/services/certificate-checklist"
      );
      const result = await requestCertificate("proj-1", "client-1", "벤처기업확인서");

      expect(result.status).toBe("PENDING");
      expect(result.itemType).toBe("CERTIFICATE");
      expect(mockChecklistItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            itemType: "CERTIFICATE",
            certificateType: "벤처기업확인서",
            status: "PENDING",
          }),
        }),
      );
    });

    it("auto-links existing valid certificate as APPROVED", async () => {
      mockChecklistItem.findFirst.mockResolvedValue(null);
      mockCertificate.findFirst.mockResolvedValue({
        id: "cert-1",
        validTo: new Date("2027-01-01"),
      });
      mockChecklistItem.create.mockResolvedValue({
        id: "ci-2",
        status: "VERIFIED",
        certificateId: "cert-1",
      });

      const { requestCertificate } = await import(
        "../../lib/services/certificate-checklist"
      );
      const result = await requestCertificate("proj-1", "client-1", "사업자등록증");

      expect(result.status).toBe("VERIFIED");
      expect(result.certificateId).toBe("cert-1");
    });

    it("returns existing pending item without creating duplicate", async () => {
      const existing = { id: "ci-3", status: "REQUESTED" };
      mockChecklistItem.findFirst.mockResolvedValue(existing);

      const { requestCertificate } = await import(
        "../../lib/services/certificate-checklist"
      );
      const result = await requestCertificate("proj-1", "client-1", "벤처기업확인서");

      expect(result).toBe(existing);
      expect(mockChecklistItem.create).not.toHaveBeenCalled();
    });
  });

  describe("fulfillCertificateUpload", () => {
    it("creates certificate and links to checklist item", async () => {
      mockChecklistItem.findUnique.mockResolvedValue({
        certificateType: "벤처기업확인서",
        certificateId: null,
      });
      mockCertificate.updateMany.mockResolvedValue({ count: 0 });
      mockCertificate.create.mockResolvedValue({ id: "cert-new" });
      mockChecklistItem.update.mockResolvedValue({ id: "ci-1" });

      const { fulfillCertificateUpload } = await import(
        "../../lib/services/certificate-checklist"
      );
      const cert = await fulfillCertificateUpload("ci-1", "client-1", {
        subjectName: "벤처기업확인서",
        storagePath: "/uploads/cert.pdf",
        validFrom: new Date("2026-01-01"),
        validTo: new Date("2028-01-01"),
      });

      expect(cert.id).toBe("cert-new");
      expect(mockCertificate.updateMany).toHaveBeenCalled(); // deactivate old
      expect(mockChecklistItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            certificateId: "cert-new",
            status: "UPLOADED",
          }),
        }),
      );
    });
  });

  describe("checkAndRequestRenewals", () => {
    it("creates renewal items for expired certificates", async () => {
      mockCertificate.findMany.mockResolvedValue([
        { id: "cert-old", type: "벤처기업확인서", subjectName: "벤처기업확인서", validTo: new Date("2025-01-01") },
      ]);
      mockChecklistItem.findFirst.mockResolvedValue(null);
      mockCertificate.findFirst.mockResolvedValue(null);
      mockChecklistItem.create.mockResolvedValue({
        id: "ci-renew",
        certificateType: "벤처기업확인서",
        status: "PENDING",
      });

      const { checkAndRequestRenewals } = await import(
        "../../lib/services/certificate-checklist"
      );
      const result = await checkAndRequestRenewals("proj-1", "client-1");

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("PENDING");
    });

    it("returns empty array when no expired certificates", async () => {
      mockCertificate.findMany.mockResolvedValue([]);

      const { checkAndRequestRenewals } = await import(
        "../../lib/services/certificate-checklist"
      );
      const result = await checkAndRequestRenewals("proj-1", "client-1");

      expect(result).toHaveLength(0);
    });
  });
});
