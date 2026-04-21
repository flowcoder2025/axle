/**
 * Tests for DART OpenAPI service + ClientFinancial sync (WI-227).
 *
 * 실제 DART 호출은 금지되어 있으므로 global fetch 와 JSZip 을 모킹한다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Prisma mock (factory — globalThis transport to avoid hoisting TDZ) ---
vi.mock("@axle/db", () => {
  const client = { findUnique: vi.fn(), update: vi.fn() };
  const clientFinancial = { upsert: vi.fn() };
  const automationLog = { create: vi.fn() };
  const prisma = { client, clientFinancial, automationLog };
  (globalThis as Record<string, unknown>).__mockPrisma = prisma;
  return { DB_PACKAGE: "@axle/db", prisma };
});

// --- JSZip mock ---
vi.mock("jszip", () => {
  const loadAsync = vi.fn(async () => ({
    file: (pattern: RegExp | string) => {
      const payload = (globalThis as Record<string, unknown>)
        .__corpXmlPayload as string;
      if (typeof pattern === "string") {
        if (pattern === "CORPCODE.xml") {
          return { async: async () => payload };
        }
        return null;
      }
      return [{ async: async () => payload }];
    },
  }));
  return { default: { loadAsync } };
});

// Convenience accessors for the prisma mocks installed by the factory above.
const prismaMocks = () =>
  (globalThis as Record<string, unknown>).__mockPrisma as {
    client: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    clientFinancial: { upsert: ReturnType<typeof vi.fn> };
    automationLog: { create: ReturnType<typeof vi.fn> };
  };
const mockPrismaClient = new Proxy(
  {},
  {
    get(_t, p: string) {
      return prismaMocks().client[p as "findUnique" | "update"];
    },
  }
) as { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
const mockPrismaFinancial = new Proxy(
  {},
  {
    get(_t, p: string) {
      return prismaMocks().clientFinancial[p as "upsert"];
    },
  }
) as { upsert: ReturnType<typeof vi.fn> };
const mockPrismaAutomationLog = new Proxy(
  {},
  {
    get(_t, p: string) {
      return prismaMocks().automationLog[p as "create"];
    },
  }
) as { create: ReturnType<typeof vi.fn> };

function setCorpXml(xml: string) {
  (globalThis as Record<string, unknown>).__corpXmlPayload = xml;
}

// --- Service import (after mocks) ---
import {
  fetchCompanyCodes,
  findCorpCodeByBusinessNumber,
  fetchAnnualFinancials,
  fetchDartFinancials,
  __resetCorpCache,
} from "@/lib/services/dart-financial";
import {
  syncClientFinancials,
  CorpCodeResolutionError,
} from "@/lib/services/client-financial-sync";

const ORIGINAL_ENV = process.env.DART_API_KEY;

beforeEach(() => {
  vi.resetAllMocks();
  __resetCorpCache();
  process.env.DART_API_KEY = "test-key";
  setCorpXml("");
  mockPrismaAutomationLog.create.mockResolvedValue({ id: "log-1" });
});

afterEach(() => {
  process.env.DART_API_KEY = ORIGINAL_ENV;
});

// Helpers
function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: "OK",
    json: async () => body,
    arrayBuffer: async () => new ArrayBuffer(0),
  } as unknown as Response;
}

function zipResponse() {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    arrayBuffer: async () => new ArrayBuffer(8),
  } as unknown as Response;
}

// ==========================================================================
// parseCorpCodeXml / fetchCompanyCodes
// ==========================================================================

describe("fetchCompanyCodes", () => {
  it("downloads + parses CORPCODE.xml into {name, corpCode, stockCode}", async () => {
    setCorpXml(`
<result>
  <list>
    <corp_code>00126380</corp_code>
    <corp_name>삼성전자</corp_name>
    <corp_eng_name>SAMSUNG ELECTRONICS</corp_eng_name>
    <stock_code>005930</stock_code>
    <modify_date>20240101</modify_date>
  </list>
  <list>
    <corp_code>00164779</corp_code>
    <corp_name>현대자동차</corp_name>
    <stock_code>005380</stock_code>
    <modify_date>20240101</modify_date>
  </list>
  <list>
    <corp_code>00999999</corp_code>
    <corp_name>비상장테크</corp_name>
    <stock_code> </stock_code>
    <modify_date>20240101</modify_date>
  </list>
</result>`);

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(zipResponse());

    const list = await fetchCompanyCodes();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(list).toHaveLength(3);
    expect(list[0]).toEqual({
      name: "삼성전자",
      corpCode: "00126380",
      stockCode: "005930",
    });
    expect(list[2].stockCode).toBeNull();
  });

  it("caches for 24h (second call does not hit fetch)", async () => {
    setCorpXml(`<result><list><corp_code>00000001</corp_code><corp_name>A</corp_name><stock_code></stock_code></list></result>`);
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(zipResponse());

    await fetchCompanyCodes();
    await fetchCompanyCodes();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("throws when DART_API_KEY missing", async () => {
    delete process.env.DART_API_KEY;
    await expect(fetchCompanyCodes()).rejects.toThrow(/DART_API_KEY/);
  });
});

// ==========================================================================
// findCorpCodeByBusinessNumber
// ==========================================================================

describe("findCorpCodeByBusinessNumber", () => {
  const LIST = [
    { name: "삼성전자", corpCode: "00126380", stockCode: "005930" },
    { name: "삼성전자서비스", corpCode: "00200001", stockCode: null },
    { name: "현대자동차", corpCode: "00164779", stockCode: "005380" },
  ];

  it("returns exact normalized match", () => {
    expect(findCorpCodeByBusinessNumber("삼성전자", LIST)?.corpCode).toBe("00126380");
  });

  it("prefers listed (stockCode) company on prefix match", () => {
    expect(findCorpCodeByBusinessNumber("삼성", LIST)?.corpCode).toBe("00126380");
  });

  it("falls back to fallbackName when primary is a bizno", () => {
    expect(
      findCorpCodeByBusinessNumber("1248100998", LIST, "현대자동차")?.corpCode
    ).toBe("00164779");
  });

  it("returns null when bizno given without fallbackName", () => {
    expect(findCorpCodeByBusinessNumber("1248100998", LIST)).toBeNull();
  });

  it("returns null when no match", () => {
    expect(findCorpCodeByBusinessNumber("존재하지않는회사XYZ", LIST)).toBeNull();
  });
});

// ==========================================================================
// fetchAnnualFinancials
// ==========================================================================

describe("fetchAnnualFinancials", () => {
  const DART_OK = {
    status: "000",
    message: "OK",
    list: [
      { account_nm: "매출액", thstrm_amount: "1,000,000", fs_div: "CFS" },
      { account_nm: "영업이익", thstrm_amount: "100,000", fs_div: "CFS" },
      { account_nm: "당기순이익", thstrm_amount: "80,000", fs_div: "CFS" },
      { account_nm: "자산총계", thstrm_amount: "5,000,000", fs_div: "CFS" },
      { account_nm: "부채총계", thstrm_amount: "2,000,000", fs_div: "CFS" },
      { account_nm: "자본총계", thstrm_amount: "3,000,000", fs_div: "CFS" },
    ],
  };

  it("maps CFS rows to normalized shape + writes AutomationLog COMPLETED", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(jsonResponse(DART_OK));

    const data = await fetchAnnualFinancials("00126380", 2023, "client-1");
    expect(data).toMatchObject({
      year: 2023,
      revenue: 1_000_000,
      operatingProfit: 100_000,
      netProfit: 80_000,
      totalAssets: 5_000_000,
      totalLiabilities: 2_000_000,
      totalEquity: 3_000_000,
      source: "DART:00126380:2023",
    });
    expect(mockPrismaAutomationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: "client-1",
          type: "DART_FETCH",
          target: "00126380:2023",
          status: "COMPLETED",
        }),
      })
    );
  });

  it("throws + logs FAILED on API error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      jsonResponse({ status: "013", message: "조회된 데이터가 없습니다." })
    );

    await expect(fetchDartFinancials("00000000", 2023)).rejects.toThrow(
      /DART API error/
    );
    expect(mockPrismaAutomationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          errorMessage: expect.stringContaining("013"),
        }),
      })
    );
  });
});

// ==========================================================================
// syncClientFinancials
// ==========================================================================

describe("syncClientFinancials", () => {
  const CLIENT = {
    id: "client-1",
    name: "삼성전자",
    corpCode: null as string | null,
    businessNumber: "1248100998",
  };

  const OK_RESPONSE = {
    status: "000",
    message: "OK",
    list: [
      { account_nm: "매출액", thstrm_amount: "1,000", fs_div: "CFS" },
      { account_nm: "영업이익", thstrm_amount: "200", fs_div: "CFS" },
      { account_nm: "당기순이익", thstrm_amount: "150", fs_div: "CFS" },
      { account_nm: "자산총계", thstrm_amount: "9,000", fs_div: "CFS" },
      { account_nm: "부채총계", thstrm_amount: "3,000", fs_div: "CFS" },
      { account_nm: "자본총계", thstrm_amount: "6,000", fs_div: "CFS" },
    ],
  };

  beforeEach(() => {
    setCorpXml(`<result><list><corp_code>00126380</corp_code><corp_name>삼성전자</corp_name><stock_code>005930</stock_code></list></result>`);
  });

  it("resolves corpCode, upserts each year, updates Client.corpCode + financialsSyncedAt", async () => {
    mockPrismaClient.findUnique.mockResolvedValue({ ...CLIENT });
    mockPrismaClient.update.mockResolvedValue({});
    mockPrismaFinancial.upsert.mockResolvedValue({});

    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce(zipResponse()); // CORPCODE
    fetchSpy.mockResolvedValueOnce(jsonResponse(OK_RESPONSE)); // 2022
    fetchSpy.mockResolvedValueOnce(jsonResponse(OK_RESPONSE)); // 2023

    const res = await syncClientFinancials("client-1", [2022, 2023]);

    expect(res.corpCode).toBe("00126380");
    expect(res.years).toHaveLength(2);
    expect(res.years.every((y) => y.status === "OK")).toBe(true);
    expect(mockPrismaFinancial.upsert).toHaveBeenCalledTimes(2);
    expect(mockPrismaFinancial.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { clientId_year: { clientId: "client-1", year: 2022 } },
        create: expect.objectContaining({
          clientId: "client-1",
          year: 2022,
          revenue: 1000,
          operatingProfit: 200,
          totalEquity: 6000,
        }),
      })
    );

    // Client.corpCode written (because input was null)
    expect(mockPrismaClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "client-1" },
        data: { corpCode: "00126380" },
      })
    );
    // financialsSyncedAt timestamp written at the end
    expect(mockPrismaClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ financialsSyncedAt: expect.any(Date) }),
      })
    );
  });

  it("skips corpCode resolution when Client.corpCode already set", async () => {
    mockPrismaClient.findUnique.mockResolvedValue({
      ...CLIENT,
      corpCode: "00126380",
    });
    mockPrismaClient.update.mockResolvedValue({});
    mockPrismaFinancial.upsert.mockResolvedValue({});

    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce(jsonResponse(OK_RESPONSE)); // 2023 only

    await syncClientFinancials("client-1", [2023]);

    // No zip/corpcode download
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const firstCallUrl = fetchSpy.mock.calls[0][0] as string;
    expect(firstCallUrl).toContain("fnlttSinglAcntAll.json");
  });

  it("throws CorpCodeResolutionError when name cannot be matched (graceful fail)", async () => {
    mockPrismaClient.findUnique.mockResolvedValue({
      ...CLIENT,
      name: "존재하지않는미상장회사999",
      corpCode: null,
    });

    vi.spyOn(global, "fetch").mockResolvedValueOnce(zipResponse());

    await expect(
      syncClientFinancials("client-1", [2023])
    ).rejects.toBeInstanceOf(CorpCodeResolutionError);

    // No financial fetch, no upsert
    expect(mockPrismaFinancial.upsert).not.toHaveBeenCalled();
  });

  it("records per-year FAILED on DART error without aborting other years", async () => {
    mockPrismaClient.findUnique.mockResolvedValue({
      ...CLIENT,
      corpCode: "00126380",
    });
    mockPrismaClient.update.mockResolvedValue({});
    mockPrismaFinancial.upsert.mockResolvedValue({});

    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ status: "013", message: "no data" })
    ); // 2022 fail
    fetchSpy.mockResolvedValueOnce(jsonResponse(OK_RESPONSE)); // 2023 ok

    const res = await syncClientFinancials("client-1", [2022, 2023]);

    expect(res.years).toEqual([
      expect.objectContaining({ year: 2022, status: "FAILED" }),
      expect.objectContaining({ year: 2023, status: "OK" }),
    ]);
    expect(mockPrismaFinancial.upsert).toHaveBeenCalledTimes(1);
  });

  it("throws when client not found", async () => {
    mockPrismaClient.findUnique.mockResolvedValue(null);
    await expect(syncClientFinancials("missing", [2023])).rejects.toThrow(
      /Client not found/
    );
  });

  it("throws when years array is empty", async () => {
    await expect(syncClientFinancials("client-1", [])).rejects.toThrow(/years/);
  });
});
