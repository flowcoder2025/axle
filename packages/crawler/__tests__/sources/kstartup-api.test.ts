import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("KStartupApiSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KSTARTUP_API_KEY = "test-key";
  });

  it("returns CrawledProgram[] from API response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            data: [
              {
                biz_pbanc_nm: "예비창업패키지",
                aply_trgt: "예비창업자",
                pbanc_rcpt_bgng_dt: "20260501",
                pbanc_rcpt_end_dt: "20260531",
                supt_regin: "서울",
                biz_pbanc_dc: "창업 지원 프로그램",
                biz_pbanc_url: "https://www.k-startup.go.kr/detail/1",
              },
            ],
          },
          totalCount: 1,
          page: 1,
        }),
    });

    const { KStartupApiSource } = await import(
      "../../src/sources/kstartup-api.js"
    );
    const source = new KStartupApiSource("test-key");
    const programs = await source.crawl();

    expect(programs).toHaveLength(1);
    expect(programs[0].name).toBe("예비창업패키지");
    expect(programs[0].category).toBe("창업");
    expect(programs[0].applicationStart).toBe("2026-05-01");
    expect(programs[0].applicationEnd).toBe("2026-05-31");
    expect(programs[0].region).toBe("서울");
    expect(programs[0].eligibility).toBe("예비창업자");
    expect(programs[0].announcementUrl).toBe(
      "https://www.k-startup.go.kr/detail/1",
    );
  });

  it("parses yyyyMMdd dates correctly", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            data: [
              {
                biz_pbanc_nm: "Test",
                pbanc_rcpt_bgng_dt: "20261201",
                pbanc_rcpt_end_dt: "20261231",
              },
            ],
          },
        }),
    });

    const { KStartupApiSource } = await import(
      "../../src/sources/kstartup-api.js"
    );
    const source = new KStartupApiSource("test-key");
    const programs = await source.crawl();

    expect(programs[0].applicationStart).toBe("2026-12-01");
    expect(programs[0].applicationEnd).toBe("2026-12-31");
  });

  it("throws when no API key", async () => {
    const { KStartupApiSource } = await import(
      "../../src/sources/kstartup-api.js"
    );
    const source = new KStartupApiSource("");
    await expect(source.crawl()).rejects.toThrow("KSTARTUP_API_KEY");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

    const { KStartupApiSource } = await import(
      "../../src/sources/kstartup-api.js"
    );
    const source = new KStartupApiSource("test-key");
    await expect(source.crawl()).rejects.toThrow("K-Startup API error: 403");
  });

  it("handles empty response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: { data: [] } }),
    });

    const { KStartupApiSource } = await import(
      "../../src/sources/kstartup-api.js"
    );
    const source = new KStartupApiSource("test-key");
    const programs = await source.crawl();
    expect(programs).toHaveLength(0);
  });
});
