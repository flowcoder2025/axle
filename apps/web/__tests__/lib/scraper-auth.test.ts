import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockApiKey } = vi.hoisted(() => ({
  mockApiKey: { findUnique: vi.fn(), update: vi.fn() },
}));
vi.mock("@axle/db", () => ({
  prisma: { scraperApiKey: mockApiKey },
}));

const { authenticateScraper, hashScraperToken } = await import("../../lib/scraper-auth");

function makeReq(headers: Record<string, string> = {}): import("next/server").NextRequest {
  const url = "http://localhost/api/scraper/health";
  const req = new Request(url, { headers });
  return req as unknown as import("next/server").NextRequest;
}

describe("scraper-auth", () => {
  beforeEach(() => {
    mockApiKey.findUnique.mockReset();
    mockApiKey.update.mockReset();
    mockApiKey.update.mockResolvedValue({});
  });

  it("rejects missing X-Scraper-Key", async () => {
    const result = await authenticateScraper(makeReq());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("rejects too-short tokens", async () => {
    const result = await authenticateScraper(makeReq({ "x-scraper-key": "abc" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("rejects unknown tokens", async () => {
    mockApiKey.findUnique.mockResolvedValue(null);
    const result = await authenticateScraper(makeReq({ "x-scraper-key": "x".repeat(40) }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("rejects revoked keys", async () => {
    mockApiKey.findUnique.mockResolvedValue({
      id: "key-1",
      orgId: "org-1",
      revokedAt: new Date(),
    });
    const result = await authenticateScraper(makeReq({ "x-scraper-key": "y".repeat(40) }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("accepts valid keys + records lastUsedAt", async () => {
    mockApiKey.findUnique.mockResolvedValue({
      id: "key-1",
      orgId: "org-1",
      revokedAt: null,
    });
    const result = await authenticateScraper(
      makeReq({ "x-scraper-key": "z".repeat(40), "x-forwarded-for": "1.2.3.4" }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.orgId).toBe("org-1");
      expect(result.apiKeyId).toBe("key-1");
    }
    // Allow async fire-and-forget update to flush
    await new Promise((r) => setImmediate(r));
    expect(mockApiKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "key-1" },
        data: expect.objectContaining({ lastUsedIp: "1.2.3.4" }),
      }),
    );
  });

  it("hashScraperToken is deterministic SHA-256 hex", () => {
    const a = hashScraperToken("token-abc");
    const b = hashScraperToken("token-abc");
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});
