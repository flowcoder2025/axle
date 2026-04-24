/**
 * Tests for WI-326 certificate renewal cron service.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCertificate, mockProject, mockChecklistTemplate, mockChecklistItem } =
  vi.hoisted(() => ({
    mockCertificate: { findMany: vi.fn() },
    mockProject: { findFirst: vi.fn(), create: vi.fn() },
    mockChecklistTemplate: { findMany: vi.fn() },
    mockChecklistItem: { createMany: vi.fn() },
  }));

const mockNotificationCreate = vi.fn();
const mockEmit = vi.fn();

// Prisma $transaction helper: invoke the callback with the same mocks so
// create + findMany calls land on our spies.
const txClient = {
  project: mockProject,
  checklistTemplate: mockChecklistTemplate,
  checklistItem: mockChecklistItem,
};

vi.mock("@axle/db", () => ({
  prisma: {
    certificate: mockCertificate,
    project: mockProject,
    $transaction: (fn: (tx: typeof txClient) => Promise<unknown>) => fn(txClient),
  },
  Prisma: {},
}));

vi.mock("@prisma/client", () => ({ Prisma: {} }));

vi.mock("@axle/notification", () => ({
  create: (payload: unknown) => {
    mockNotificationCreate(payload);
    return Promise.resolve();
  },
}));

vi.mock("../../lib/events/event-bus", () => ({
  eventBus: {
    emit: (...args: unknown[]) => {
      mockEmit(...args);
      return Promise.resolve();
    },
  },
}));

import {
  runCertificateRenewalScan,
  findCertificatesNearExpiry,
} from "../../lib/services/certificate-renewal";

const NOW = new Date("2026-04-24T00:00:00Z");
const IN_60_DAYS = new Date("2026-06-23T00:00:00Z");
const IN_180_DAYS = new Date("2026-10-21T00:00:00Z");

function makeCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: "cert-1",
    type: "벤처기업확인서",
    validTo: IN_60_DAYS,
    clientId: "client-1",
    subjectName: "주식회사 제이이티",
    client: {
      id: "client-1",
      name: "JET",
      orgId: "org-1",
      assignedToId: "user-consultant",
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockChecklistTemplate.findMany.mockResolvedValue([]);
  mockChecklistItem.createMany.mockResolvedValue({ count: 0 });
});

describe("findCertificatesNearExpiry", () => {
  it("queries active certificates whose validTo falls in the lead window", async () => {
    mockCertificate.findMany.mockResolvedValue([]);
    await findCertificatesNearExpiry(90, NOW);
    const [args] = mockCertificate.findMany.mock.calls;
    expect(args[0].where.isActive).toBe(true);
    expect(args[0].where.validTo.gt).toEqual(NOW);
    const cutoff = new Date(NOW.getTime() + 90 * 24 * 60 * 60 * 1000);
    expect(args[0].where.validTo.lte).toEqual(cutoff);
  });
});

describe("runCertificateRenewalScan", () => {
  it("creates INTAKE renewal project with metadata tag + notifies assignee", async () => {
    mockCertificate.findMany.mockResolvedValue([makeCandidate()]);
    mockProject.findFirst.mockResolvedValue(null);
    mockProject.create.mockResolvedValue({ id: "renew-proj-1" });

    const report = await runCertificateRenewalScan({ now: NOW });

    expect(report).toEqual({
      scanned: 1,
      created: 1,
      alreadyInProgress: 0,
      skipped: 0,
    });

    // Project.create received the expected shape + metadata tag.
    const createArg = mockProject.create.mock.calls[0][0].data;
    expect(createArg).toMatchObject({
      clientId: "client-1",
      type: "VENTURE_CERT",
      status: "INTAKE",
      assignedToId: "user-consultant",
      dueDate: IN_60_DAYS,
    });
    expect(createArg.metadata).toMatchObject({
      renewalOfCertificateId: "cert-1",
    });

    // Notification routed to the consultant.
    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-consultant",
        type: "DEADLINE",
        link: "/projects/renew-proj-1",
      }),
    );

    // Event emitted with computed daysUntilExpiry.
    expect(mockEmit).toHaveBeenCalledWith(
      "CERTIFICATE_RENEWING",
      expect.objectContaining({
        certificateId: "cert-1",
        renewalProjectId: "renew-proj-1",
        daysUntilExpiry: 60,
      }),
    );
  });

  it("skips certificates that already have an open renewal project", async () => {
    mockCertificate.findMany.mockResolvedValue([makeCandidate()]);
    mockProject.findFirst.mockResolvedValue({ id: "existing-renew" });

    const report = await runCertificateRenewalScan({ now: NOW });

    expect(report.alreadyInProgress).toBe(1);
    expect(report.created).toBe(0);
    expect(mockProject.create).not.toHaveBeenCalled();
    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("skips certificates with no project-type mapping", async () => {
    mockCertificate.findMany.mockResolvedValue([
      makeCandidate({ type: "알수없는인증서" }),
    ]);

    const report = await runCertificateRenewalScan({ now: NOW });

    expect(report.skipped).toBe(1);
    expect(report.created).toBe(0);
    expect(mockProject.create).not.toHaveBeenCalled();
  });

  it("does not notify when the client has no assignee", async () => {
    mockCertificate.findMany.mockResolvedValue([
      makeCandidate({
        client: {
          id: "client-1",
          name: "JET",
          orgId: "org-1",
          assignedToId: null,
        },
      }),
    ]);
    mockProject.findFirst.mockResolvedValue(null);
    mockProject.create.mockResolvedValue({ id: "renew-no-assignee" });

    const report = await runCertificateRenewalScan({ now: NOW });

    expect(report.created).toBe(1);
    expect(mockNotificationCreate).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("attaches checklist template items when the org has them", async () => {
    mockCertificate.findMany.mockResolvedValue([makeCandidate()]);
    mockProject.findFirst.mockResolvedValue(null);
    mockProject.create.mockResolvedValue({ id: "renew-proj-with-checklist" });
    mockChecklistTemplate.findMany.mockResolvedValue([
      { name: "벤처확인서 신청서", description: "중기부 양식", isRequired: true },
      { name: "기술성평가서", description: null, isRequired: true },
    ]);

    await runCertificateRenewalScan({ now: NOW });

    expect(mockChecklistItem.createMany).toHaveBeenCalledWith({
      data: [
        {
          projectId: "renew-proj-with-checklist",
          name: "벤처확인서 신청서",
          description: "중기부 양식",
          isRequired: true,
        },
        {
          projectId: "renew-proj-with-checklist",
          name: "기술성평가서",
          description: null,
          isRequired: true,
        },
      ],
    });
  });

  it("ignores certificates whose validTo is outside the lead window", async () => {
    // Far-future cert shouldn't even be returned by the DB filter, but the
    // service must still behave correctly if the DB happens to return it.
    mockCertificate.findMany.mockResolvedValue([
      makeCandidate({ validTo: IN_180_DAYS }),
    ]);
    mockProject.findFirst.mockResolvedValue(null);
    mockProject.create.mockResolvedValue({ id: "far-future" });

    const report = await runCertificateRenewalScan({ now: NOW });
    expect(report.scanned).toBe(1);
    expect(report.created).toBe(1);
    // daysUntilExpiry should reflect the actual distance (180).
    const emitCall = mockEmit.mock.calls[0];
    expect(emitCall[1].daysUntilExpiry).toBeGreaterThan(170);
  });
});
