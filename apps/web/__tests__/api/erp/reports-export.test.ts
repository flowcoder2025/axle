/**
 * Phase 21 WI-731-feat — async export job tests.
 *
 * Covers:
 *   - POST /api/erp/reports/export: auth, validation, returns 202 + jobId
 *   - GET /api/erp/reports/export/[jobId]: status reporting, RED 404
 *   - tenant scoping (different orgId → 404)
 *   - rendering pipeline: AiJob row transitions QUEUED → RUNNING → COMPLETED
 *     and the output carries blobUrl + sizeBytes
 *
 * The Blob upload + report aggregations are mocked so the test stays
 * deterministic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
  checkModulePermission: vi.fn(),
}));

vi.mock("@/src/lib/tenant-context", () => ({
  getActiveTenant: vi.fn(),
}));

vi.mock("@axle/db", () => {
  const aiJob = {
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
  };
  const $queryRawUnsafe = vi.fn();
  const erpCounterparty = { findMany: vi.fn() };
  const mvRefreshLog = { findFirst: vi.fn() };
  const chartOfAccounts = { findMany: vi.fn() };
  const product = { findMany: vi.fn() };
  const organization = { findUnique: vi.fn() };
  return {
    DB_PACKAGE: "@axle/db",
    prisma: {
      aiJob,
      $queryRawUnsafe,
      erpCounterparty,
      mvRefreshLog,
      chartOfAccounts,
      product,
      organization,
    },
  };
});

vi.mock("@/lib/erp/blob", () => ({
  uploadReportExport: vi.fn(),
}));

vi.mock("@axle/ai", () => ({
  resolveAiTier: vi.fn().mockReturnValue("API_HAIKU"),
}));

import { prisma } from "@axle/db";
import { getCurrentUser, checkModulePermission } from "@axle/auth";
import { getActiveTenant } from "@/src/lib/tenant-context";
import { uploadReportExport } from "@/lib/erp/blob";
import { POST } from "../../../app/api/erp/reports/export/route";
import { GET } from "../../../app/api/erp/reports/export/[jobId]/route";

const aiJobMock = (prisma as unknown as {
  aiJob: Record<string, ReturnType<typeof vi.fn>>;
}).aiJob;
const queryMock = (prisma as unknown as {
  $queryRawUnsafe: ReturnType<typeof vi.fn>;
}).$queryRawUnsafe;
const cpMock = (prisma as unknown as {
  erpCounterparty: Record<string, ReturnType<typeof vi.fn>>;
}).erpCounterparty;
const refreshMock = (prisma as unknown as {
  mvRefreshLog: Record<string, ReturnType<typeof vi.fn>>;
}).mvRefreshLog;
const organizationMock = (prisma as unknown as {
  organization: Record<string, ReturnType<typeof vi.fn>>;
}).organization;
const uploadMock = uploadReportExport as unknown as ReturnType<typeof vi.fn>;

const authedUser = { id: "u1", orgId: "org_test", email: "u1@x", name: "u" };

function postReq(body: unknown): Request {
  return new Request("http://x/api/erp/reports/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getReq(): Request {
  return new Request("http://x/api/erp/reports/export/x");
}

function ctx(jobId: string) {
  return { params: Promise.resolve({ jobId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  (getCurrentUser as unknown as { mockResolvedValue: Function }).mockResolvedValue(
    authedUser,
  );
  (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(
    true,
  );
  (getActiveTenant as unknown as { mockResolvedValue: Function }).mockResolvedValue({
    id: "org_test",
    isManaged: false,
    name: "test-org",
  });
  organizationMock.findUnique.mockResolvedValue({ name: "test-org" });

  aiJobMock.create.mockResolvedValue({ id: "job_1" });
  aiJobMock.update.mockResolvedValue({});
  queryMock.mockResolvedValue([]);
  cpMock.findMany.mockResolvedValue([]);
  refreshMock.findFirst.mockResolvedValue(null);
  uploadMock.mockResolvedValue("https://blob.vercel-storage.com/test-export.csv");
});

describe("POST /api/erp/reports/export — auth + validation", () => {
  it("401 when no user", async () => {
    (getCurrentUser as unknown as { mockResolvedValue: Function }).mockResolvedValue(null);
    const res = await POST(
      postReq({ reportType: "counterparty", format: "csv", params: {} }),
    );
    expect(res.status).toBe(401);
    expect(aiJobMock.create).not.toHaveBeenCalled();
  });

  it("403 when erp:read missing", async () => {
    (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(
      false,
    );
    const res = await POST(
      postReq({ reportType: "counterparty", format: "csv", params: {} }),
    );
    expect(res.status).toBe(403);
  });

  it("400 when reportType unknown", async () => {
    const res = await POST(
      postReq({ reportType: "MOON", format: "csv", params: {} }),
    );
    expect(res.status).toBe(400);
  });

  it("400 when format unsupported", async () => {
    const res = await POST(
      postReq({ reportType: "counterparty", format: "xlsx", params: {} }),
    );
    expect(res.status).toBe(400);
  });

  it("400 when body is not JSON", async () => {
    const req = new Request("http://x/api/erp/reports/export", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "text/plain" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/erp/reports/export — happy path", () => {
  it("returns 202 + jobId + pollUrl, creates AiJob row in QUEUED", async () => {
    const res = await POST(
      postReq({
        reportType: "counterparty",
        format: "csv",
        params: { from: "2026-01", to: "2026-05", type: "SALE" },
      }),
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.jobId).toBe("job_1");
    expect(body.pollUrl).toBe("/api/erp/reports/export/job_1");

    expect(aiJobMock.create).toHaveBeenCalledTimes(1);
    const createArgs = aiJobMock.create.mock.calls[0]?.[0];
    expect(createArgs.data).toMatchObject({
      orgId: "org_test",
      type: "REPORT_EXPORT",
      status: "QUEUED",
    });
    expect(createArgs.data.input).toMatchObject({
      reportType: "counterparty",
      format: "csv",
    });
  });
});

describe("GET /api/erp/reports/export/[jobId]", () => {
  it("RED — unknown jobId → 404", async () => {
    aiJobMock.findFirst.mockResolvedValue(null);
    const res = await GET(getReq(), ctx("nope"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when the jobId belongs to a different org (tenant scoping)", async () => {
    // The query already filters by orgId, so this is effectively the same
    // assertion as above — but exercised explicitly to document intent.
    aiJobMock.findFirst.mockResolvedValue(null);
    const res = await GET(getReq(), ctx("other_org_job"));
    expect(res.status).toBe(404);
    expect(aiJobMock.findFirst).toHaveBeenCalledWith({
      where: {
        id: "other_org_job",
        orgId: "org_test",
        type: "REPORT_EXPORT",
      },
      select: expect.any(Object),
    });
  });

  it("QUEUED → status only", async () => {
    aiJobMock.findFirst.mockResolvedValue({
      id: "job_q",
      status: "QUEUED",
      output: null,
      errorMessage: null,
      createdAt: new Date("2026-05-22T10:00:00.000Z"),
      durationMs: null,
    });
    const res = await GET(getReq(), ctx("job_q"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("QUEUED");
    expect(body.output).toBeUndefined();
    expect(body.error).toBeUndefined();
  });

  it("COMPLETED → status + output (format, blobUrl, sizeBytes, filename)", async () => {
    aiJobMock.findFirst.mockResolvedValue({
      id: "job_c",
      status: "COMPLETED",
      output: {
        format: "csv",
        blobUrl: "https://blob.vercel-storage.com/foo.csv",
        sizeBytes: 1234,
        filename: "counterparty-job_c.csv",
      },
      errorMessage: null,
      createdAt: new Date("2026-05-22T10:00:00.000Z"),
      durationMs: 4500,
    });
    const res = await GET(getReq(), ctx("job_c"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("COMPLETED");
    expect(body.output.blobUrl).toBe("https://blob.vercel-storage.com/foo.csv");
    expect(body.output.format).toBe("csv");
    expect(body.output.sizeBytes).toBe(1234);
    expect(body.durationMs).toBe(4500);
  });

  it("FAILED → status + error message", async () => {
    aiJobMock.findFirst.mockResolvedValue({
      id: "job_f",
      status: "FAILED",
      output: null,
      errorMessage: "EXPORT_BAD_PARAM: from must be YYYY-MM",
      createdAt: new Date("2026-05-22T10:00:00.000Z"),
      durationMs: 200,
    });
    const res = await GET(getReq(), ctx("job_f"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("FAILED");
    expect(body.error).toContain("EXPORT_BAD_PARAM");
  });
});

describe("runReportExportInline — pipeline", () => {
  it("transitions QUEUED → RUNNING → COMPLETED + uploads + sets output", async () => {
    // Import after the mocks above have been applied.
    const { runReportExportInline } = await import(
      "../../../lib/erp/report-export"
    );

    queryMock.mockResolvedValueOnce([]); // counterpartyReport mv query

    await runReportExportInline("job_inline", "org_test", {
      reportType: "counterparty",
      format: "csv",
      params: { from: "2026-01", to: "2026-05", type: "SALE" },
    });

    // 1st update = RUNNING, 2nd = COMPLETED
    expect(aiJobMock.update).toHaveBeenCalledTimes(2);
    expect(aiJobMock.update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "job_inline" },
      data: { status: "RUNNING" },
    });
    const completed = aiJobMock.update.mock.calls[1]?.[0];
    expect(completed.data.status).toBe("COMPLETED");
    expect(completed.data.output).toMatchObject({
      format: "csv",
      blobUrl: "https://blob.vercel-storage.com/test-export.csv",
    });
    expect(completed.data.output.sizeBytes).toBeGreaterThan(0);
    expect(uploadMock).toHaveBeenCalledTimes(1);
  });

  it("transitions to FAILED + records error when the report helper throws", async () => {
    const { runReportExportInline } = await import(
      "../../../lib/erp/report-export"
    );

    await runReportExportInline("job_err", "org_test", {
      // Missing required params → EXPORT_BAD_PARAM
      reportType: "counterparty",
      format: "csv",
      params: {},
    });

    expect(aiJobMock.update).toHaveBeenCalledTimes(2);
    const failed = aiJobMock.update.mock.calls[1]?.[0];
    expect(failed.data.status).toBe("FAILED");
    expect(String(failed.data.errorMessage)).toContain("EXPORT_BAD_PARAM");
    expect(uploadMock).not.toHaveBeenCalled();
  });
});
