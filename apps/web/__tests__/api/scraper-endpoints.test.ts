import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// --- Mocks (hoisted for vi.mock factory access) ---
const {
  mockApiKey,
  mockClient,
  mockClientCert,
  mockPortalAccount,
  mockScraperJob,
  mockAutomationLog,
  mockRepairLog,
  mockTransaction,
  mockQueryRaw,
} = vi.hoisted(() => ({
  mockApiKey: { findUnique: vi.fn(), update: vi.fn() },
  mockClient: { findFirst: vi.fn() },
  mockClientCert: { findFirst: vi.fn(), findUnique: vi.fn() },
  mockPortalAccount: { findFirst: vi.fn(), findUnique: vi.fn() },
  mockScraperJob: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  mockAutomationLog: { create: vi.fn() },
  mockRepairLog: { create: vi.fn() },
  mockTransaction: vi.fn(),
  mockQueryRaw: vi.fn(),
}));

vi.mock("@axle/db", () => ({
  prisma: {
    scraperApiKey: mockApiKey,
    client: mockClient,
    clientCertificate: mockClientCert,
    clientPortalAccount: mockPortalAccount,
    scraperJob: mockScraperJob,
    automationLog: mockAutomationLog,
    scraperRepairLog: mockRepairLog,
    $transaction: (...args: unknown[]) => mockTransaction(...args),
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

vi.mock("@axle/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/scraper-blob", () => ({
  uploadScraperResult: vi.fn(),
}));

vi.mock("@/lib/scraper-crypto", () => ({
  decryptCredential: vi.fn((s: string) => `dec:${s}`),
  decryptCredentialBytes: vi.fn(() => Buffer.from([0x30, 0x82])),
}));

vi.stubEnv("CRON_SECRET", "test-cron-secret");

import { getCurrentUser } from "@axle/auth";
import { uploadScraperResult } from "@/lib/scraper-blob";
import { GET as healthGet } from "../../app/api/scraper/health/route";
import { POST as jobsPost } from "../../app/api/scraper/jobs/route";
import { GET as jobsNextGet } from "../../app/api/scraper/jobs/next/route";
import { POST as resultsPost } from "../../app/api/scraper/results/route";
import { POST as repairPost } from "../../app/api/scraper/repair/route";
import { POST as reportPost } from "../../app/api/scraper/report/route";
import { POST as sweepPost } from "../../app/api/cron/scraper-sweep/route";

const KEY = "k".repeat(40);

function makeScraperReq(
  url = "http://localhost/api/scraper/health",
  init: RequestInit = {},
): NextRequest {
  const headers = new Headers(init.headers ?? {});
  headers.set("x-scraper-key", KEY);
  return new Request(url, { ...init, headers }) as unknown as NextRequest;
}

function makeWebReq(
  url = "http://localhost/api/scraper/jobs",
  init: RequestInit = {},
): NextRequest {
  return new Request(url, init) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApiKey.findUnique.mockResolvedValue({
    id: "key-1",
    orgId: "org-1",
    revokedAt: null,
  });
  mockApiKey.update.mockResolvedValue({});
});

describe("GET /api/scraper/health", () => {
  it("returns ok with valid key", async () => {
    const res = await healthGet(makeScraperReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.version).toBeDefined();
  });

  it("returns 401 with no key", async () => {
    const req = new Request("http://localhost/api/scraper/health") as unknown as NextRequest;
    const res = await healthGet(req);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/scraper/jobs (internal enqueue)", () => {
  it("requires session auth", async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await jobsPost(
      makeWebReq("http://localhost/api/scraper/jobs", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects when client not in user's org", async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "u1", orgId: "org-1" });
    mockClient.findFirst.mockResolvedValue(null);
    const res = await jobsPost(
      makeWebReq("http://localhost/api/scraper/jobs", {
        method: "POST",
        body: JSON.stringify({
          clientId: "c1",
          type: "HOMETAX_ISSUE",
          target: "납세증명서",
          credentialsRef: "cert-1",
          credentialsKind: "CERTIFICATE",
        }),
      }),
    );
    expect(res.status).toBe(404);
  });

  it("rejects expired certificate", async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "u1", orgId: "org-1" });
    mockClient.findFirst.mockResolvedValue({ id: "c1" });
    mockClientCert.findFirst.mockResolvedValue({
      id: "cert-1",
      validTo: new Date("2020-01-01"),
    });
    const res = await jobsPost(
      makeWebReq("http://localhost/api/scraper/jobs", {
        method: "POST",
        body: JSON.stringify({
          clientId: "c1",
          type: "HOMETAX_ISSUE",
          target: "납세증명서",
          credentialsRef: "cert-1",
          credentialsKind: "CERTIFICATE",
        }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it("creates ScraperJob successfully", async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "u1", orgId: "org-1" });
    mockClient.findFirst.mockResolvedValue({ id: "c1" });
    mockClientCert.findFirst.mockResolvedValue({
      id: "cert-1",
      validTo: new Date(Date.now() + 86400000),
    });
    mockScraperJob.create.mockResolvedValue({ id: "job-1", status: "QUEUED" });

    const res = await jobsPost(
      makeWebReq("http://localhost/api/scraper/jobs", {
        method: "POST",
        body: JSON.stringify({
          clientId: "c1",
          type: "HOMETAX_ISSUE",
          target: "납세증명서",
          params: { year: 2026 },
          credentialsRef: "cert-1",
          credentialsKind: "CERTIFICATE",
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.jobId).toBe("job-1");
    expect(body.status).toBe("QUEUED");
  });
});

describe("GET /api/scraper/jobs/next", () => {
  it("returns 204 when no jobs", async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        scraperJob: { update: vi.fn() },
      };
      return fn(tx);
    });
    const res = await jobsNextGet(makeScraperReq("http://localhost/api/scraper/jobs/next"));
    expect(res.status).toBe(204);
  });

  it("returns job with decrypted certificate credentials", async () => {
    const job = {
      id: "job-1",
      orgId: "org-1",
      clientId: "c1",
      type: "HOMETAX_ISSUE",
      target: "납세증명서",
      params: { year: 2026 },
      credentialsKind: "CERTIFICATE",
      credentialsRef: "cert-1",
    };
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "job-1" }]),
        scraperJob: { update: vi.fn().mockResolvedValue(job) },
      };
      return fn(tx);
    });
    mockClientCert.findUnique.mockResolvedValue({
      id: "cert-1",
      pfxCiphertext: "enc-pfx",
      passwordCiphertext: "enc-pw",
    });
    const res = await jobsNextGet(makeScraperReq("http://localhost/api/scraper/jobs/next"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobId).toBe("job-1");
    expect(body.credentials.method).toBe("certificate");
    expect(body.credentials.pfxBase64).toBeDefined();
    expect(body.credentials.certPassword).toBe("dec:enc-pw");
    expect(body.leaseSeconds).toBe(3600);
  });

  it("returns 204 + marks FAILED when credentials gone", async () => {
    const job = {
      id: "job-1",
      orgId: "org-1",
      clientId: "c1",
      type: "HOMETAX_ISSUE",
      target: "x",
      params: {},
      credentialsKind: "CERTIFICATE",
      credentialsRef: "missing",
    };
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "job-1" }]),
        scraperJob: { update: vi.fn().mockResolvedValue(job) },
      };
      return fn(tx);
    });
    mockClientCert.findUnique.mockResolvedValue(null);
    const res = await jobsNextGet(makeScraperReq("http://localhost/api/scraper/jobs/next"));
    expect(res.status).toBe(204);
    expect(mockScraperJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "job-1" }, data: expect.objectContaining({ status: "FAILED" }) }),
    );
  });
});

describe("POST /api/scraper/results", () => {
  function makeResultReq(metadata: object, file?: { name: string; type: string; bytes: Uint8Array }) {
    const fd = new FormData();
    fd.append("metadata", JSON.stringify(metadata));
    if (file) {
      const ab = file.bytes.buffer.slice(
        file.bytes.byteOffset,
        file.bytes.byteOffset + file.bytes.byteLength,
      ) as ArrayBuffer;
      fd.append("file", new Blob([ab], { type: file.type }), file.name);
    }
    const headers = new Headers();
    headers.set("x-scraper-key", KEY);
    return new Request("http://localhost/api/scraper/results", {
      method: "POST",
      body: fd,
      headers,
    }) as unknown as NextRequest;
  }

  it("rejects missing metadata", async () => {
    const fd = new FormData();
    const headers = new Headers();
    headers.set("x-scraper-key", KEY);
    const req = new Request("http://localhost/api/scraper/results", {
      method: "POST",
      body: fd,
      headers,
    }) as unknown as NextRequest;
    const res = await resultsPost(req);
    expect(res.status).toBe(422);
  });

  it("returns 404 when job not in calling org", async () => {
    mockScraperJob.findFirst.mockResolvedValue(null);
    const res = await resultsPost(
      makeResultReq({ jobId: "job-x", status: "FAILED", errorMessage: "x" }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 409 when job already COMPLETED", async () => {
    mockScraperJob.findFirst.mockResolvedValue({
      id: "job-1",
      orgId: "org-1",
      status: "COMPLETED",
      leaseExpiresAt: null,
    });
    const res = await resultsPost(
      makeResultReq({ jobId: "job-1", status: "FAILED", errorMessage: "x" }),
    );
    expect(res.status).toBe(409);
  });

  it("returns 410 when lease expired", async () => {
    mockScraperJob.findFirst.mockResolvedValue({
      id: "job-1",
      orgId: "org-1",
      status: "PICKED_UP",
      leaseExpiresAt: new Date(Date.now() - 1000),
    });
    const res = await resultsPost(
      makeResultReq({ jobId: "job-1", status: "FAILED", errorMessage: "x" }),
    );
    expect(res.status).toBe(410);
  });

  it("rejects COMPLETED without file", async () => {
    mockScraperJob.findFirst.mockResolvedValue({
      id: "job-1",
      orgId: "org-1",
      clientId: "c1",
      type: "HOMETAX_ISSUE",
      target: "납세증명서",
      status: "PICKED_UP",
      leaseExpiresAt: new Date(Date.now() + 60_000),
    });
    const res = await resultsPost(makeResultReq({ jobId: "job-1", status: "COMPLETED" }));
    expect(res.status).toBe(422);
  });

  it("uploads file + creates AutomationLog on COMPLETED", async () => {
    mockScraperJob.findFirst.mockResolvedValue({
      id: "job-1",
      orgId: "org-1",
      clientId: "c1",
      type: "HOMETAX_ISSUE",
      target: "납세증명서",
      status: "PICKED_UP",
      leaseExpiresAt: new Date(Date.now() + 60_000),
    });
    (uploadScraperResult as ReturnType<typeof vi.fn>).mockResolvedValue({
      url: "https://blob.vercel/x.pdf",
      pathname: "p",
      contentType: "application/pdf",
      size: 4,
    });
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        automationLog: { create: vi.fn().mockResolvedValue({ id: "log-1" }) },
        scraperJob: { update: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });

    const res = await resultsPost(
      makeResultReq(
        { jobId: "job-1", status: "COMPLETED" },
        { name: "x.pdf", type: "application/pdf", bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]) },
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.automationLogId).toBe("log-1");
    expect(body.resultUrl).toBe("https://blob.vercel/x.pdf");
    expect(uploadScraperResult).toHaveBeenCalled();
  });

  it("FAILED skips upload but creates AutomationLog", async () => {
    mockScraperJob.findFirst.mockResolvedValue({
      id: "job-1",
      orgId: "org-1",
      clientId: "c1",
      type: "HOMETAX_ISSUE",
      target: "납세증명서",
      status: "PICKED_UP",
      leaseExpiresAt: new Date(Date.now() + 60_000),
    });
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        automationLog: { create: vi.fn().mockResolvedValue({ id: "log-2" }) },
        scraperJob: { update: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });
    const res = await resultsPost(
      makeResultReq({
        jobId: "job-1",
        status: "FAILED",
        errorCode: "LOGIN_FAILED",
        errorMessage: "bad password",
      }),
    );
    expect(res.status).toBe(200);
    expect(uploadScraperResult).not.toHaveBeenCalled();
  });
});

describe("POST /api/scraper/repair", () => {
  it("rejects invalid input", async () => {
    const res = await repairPost(
      makeScraperReq("http://localhost/api/scraper/repair", {
        method: "POST",
        body: JSON.stringify({ portal: "INVALID" }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(422);
  });

  it("creates repair log without screenshot", async () => {
    mockRepairLog.create.mockResolvedValue({ id: "rep-1" });
    const res = await repairPost(
      makeScraperReq("http://localhost/api/scraper/repair", {
        method: "POST",
        body: JSON.stringify({
          portal: "HOMETAX",
          page: "login",
          element: "submit",
          oldSelector: "#a",
          newSelector: "#b",
          repairedBy: "tier1",
        }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(200);
    expect(mockRepairLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ portal: "HOMETAX", screenshotUrl: null }),
      }),
    );
  });

  it("rejects when jobId not in calling org", async () => {
    mockScraperJob.findFirst.mockResolvedValue(null);
    const res = await repairPost(
      makeScraperReq("http://localhost/api/scraper/repair", {
        method: "POST",
        body: JSON.stringify({
          jobId: "job-other",
          portal: "HOMETAX",
          page: "login",
          element: "submit",
          oldSelector: "#a",
          newSelector: "#b",
          repairedBy: "tier1",
        }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/scraper/report", () => {
  it("acks valid report", async () => {
    const res = await reportPost(
      makeScraperReq("http://localhost/api/scraper/report", {
        method: "POST",
        body: JSON.stringify({
          scraperInstanceId: "host:123",
          startedAt: "2026-04-26T00:00:00.000Z",
          completedAt: "2026-04-26T00:10:00.000Z",
          jobsProcessed: 3,
          jobsSucceeded: 2,
          jobsFailed: 1,
          repairsTriggered: 0,
          version: "0.1.0",
        }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accepted).toBe(true);
  });
});

describe("POST /api/cron/scraper-sweep", () => {
  function makeCronReq(token: string | null = "test-cron-secret") {
    const headers = new Headers();
    if (token) headers.set("authorization", `Bearer ${token}`);
    return new Request("http://localhost/api/cron/scraper-sweep", { method: "POST", headers });
  }

  it("rejects without cron auth", async () => {
    const res = await sweepPost(makeCronReq(null));
    expect(res.status).toBe(401);
  });

  it("requeues expired jobs (retries < 3)", async () => {
    mockScraperJob.findMany.mockResolvedValue([{ id: "job-1", params: {} }]);
    mockScraperJob.update.mockResolvedValue({});
    const res = await sweepPost(makeCronReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requeued).toBe(1);
    expect(body.failed).toBe(0);
    expect(mockScraperJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "QUEUED",
          params: { __retries: 1 },
        }),
      }),
    );
  });

  it("FAILs jobs after 3 retries", async () => {
    mockScraperJob.findMany.mockResolvedValue([{ id: "job-1", params: { __retries: 3 } }]);
    mockAutomationLog.create.mockResolvedValue({ id: "log-1" });
    mockScraperJob.update.mockResolvedValue({});
    const res = await sweepPost(makeCronReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.failed).toBe(1);
    expect(body.requeued).toBe(0);
    expect(mockScraperJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });
});
