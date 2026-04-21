import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("BizinfoApiSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BIZINFO_API_KEY = "test-key";
  });

  it("returns CrawledProgram[] from API response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          jsonArray: [
            {
              pblancNm: "창업 지원사업 공고",
              jrsdInsttNm: "중소벤처기업부",
              pldirSportRealmLclasCodeNm: "창업지원",
              reqstBeginEndDe: "20260401~20260430",
              trgetNm: "예비창업자",
              link: "https://www.bizinfo.go.kr/detail/1234",
              bsnsSumryCn: "사업 개요 설명",
            },
          ],
        }),
    });

    const { BizinfoApiSource } = await import(
      "../../src/sources/bizinfo-api.js"
    );
    const source = new BizinfoApiSource("test-key");
    const programs = await source.crawl();

    expect(programs).toHaveLength(1);
    expect(programs[0].name).toBe("창업 지원사업 공고");
    expect(programs[0].agency).toBe("중소벤처기업부");
    expect(programs[0].category).toBe("창업");
    expect(programs[0].applicationStart).toBe("2026-04-01");
    expect(programs[0].applicationEnd).toBe("2026-04-30");
    expect(programs[0].eligibility).toBe("예비창업자");
    expect(programs[0].announcementUrl).toBe(
      "https://www.bizinfo.go.kr/detail/1234",
    );
  });

  it("maps categories correctly", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          jsonArray: [
            { pblancNm: "R&D", pldirSportRealmLclasCodeNm: "기술개발" },
            { pblancNm: "수출", pldirSportRealmLclasCodeNm: "수출지원" },
            { pblancNm: "기타", pldirSportRealmLclasCodeNm: "기타분야" },
          ],
        }),
    });

    const { BizinfoApiSource } = await import(
      "../../src/sources/bizinfo-api.js"
    );
    const source = new BizinfoApiSource("test-key");
    const programs = await source.crawl();

    expect(programs[0].category).toBe("R&D");
    expect(programs[1].category).toBe("수출");
    expect(programs[2].category).toBe("기타");
  });

  it("throws when no API key", async () => {
    const { BizinfoApiSource } = await import(
      "../../src/sources/bizinfo-api.js"
    );
    const source = new BizinfoApiSource("");
    await expect(source.crawl()).rejects.toThrow("BIZINFO_API_KEY");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const { BizinfoApiSource } = await import(
      "../../src/sources/bizinfo-api.js"
    );
    const source = new BizinfoApiSource("test-key");
    await expect(source.crawl()).rejects.toThrow("Bizinfo API error: 500");
  });

  it("fetchAllPrograms paginates until a short page and caps at maxItems", async () => {
    const pageUnit = 2;
    const page1 = [
      { pblancNm: "A", pblancId: "1", link: "https://b/1" },
      { pblancNm: "B", pblancId: "2", link: "https://b/2" },
    ];
    const page2 = [{ pblancNm: "C", pblancId: "3", link: "https://b/3" }];

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jsonArray: page1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jsonArray: page2 }),
      });

    const { BizinfoApiSource } = await import(
      "../../src/sources/bizinfo-api.js"
    );
    const source = new BizinfoApiSource("test-key");
    const programs = await source.fetchAllPrograms(500, pageUnit);

    expect(programs).toHaveLength(3);
    expect(programs.map((p) => p.externalId)).toEqual(["1", "2", "3"]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("fetchAllPrograms stops when maxItems is reached", async () => {
    const page1 = Array.from({ length: 5 }, (_, i) => ({
      pblancNm: `P${i}`,
      pblancId: String(i),
    }));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ jsonArray: page1 }),
    });

    const { BizinfoApiSource } = await import(
      "../../src/sources/bizinfo-api.js"
    );
    const source = new BizinfoApiSource("test-key");
    const programs = await source.fetchAllPrograms(3, 5);

    expect(programs).toHaveLength(3);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("derives externalId from link when pblancId is missing", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          jsonArray: [
            { pblancNm: "name", link: "https://b.go.kr/detail/9876" },
          ],
        }),
    });

    const { BizinfoApiSource } = await import(
      "../../src/sources/bizinfo-api.js"
    );
    const source = new BizinfoApiSource("test-key");
    const programs = await source.crawl();

    expect(programs[0].externalId).toBe("link-9876");
  });
});
