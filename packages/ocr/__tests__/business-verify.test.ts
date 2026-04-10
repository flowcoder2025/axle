import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyBusinessNumber } from "../src/business-verify.js";

function makeNtsResponse(bSttCd: string, bStt: string) {
  return {
    status_code: "OK",
    request_cnt: 1,
    valid_cnt: 1,
    data: [
      {
        b_no: "1234567890",
        b_stt: bStt,
        b_stt_cd: bSttCd,
        tax_type: "부가가치세 일반과세자",
        tax_type_cd: "01",
        end_dt: "",
        utcc_yn: "N",
        tax_type_change_dt: "",
        invoice_apply_dt: "",
        rbf_tax_type: "",
        rbf_tax_type_cd: "",
      },
    ],
  };
}

describe("verifyBusinessNumber", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.DATA_GO_KR_API_KEY = "test-api-key";
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("returns valid=true and status=정상 for an active business", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => makeNtsResponse("01", "계속사업자"),
    } as Response);

    const result = await verifyBusinessNumber("123-45-67890");

    expect(result.valid).toBe(true);
    expect(result.status).toBe("정상");
  });

  it("returns valid=false and status=휴업 for a suspended business", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => makeNtsResponse("02", "휴업자"),
    } as Response);

    const result = await verifyBusinessNumber("1234567890");

    expect(result.valid).toBe(false);
    expect(result.status).toBe("휴업");
  });

  it("returns valid=false and status=폐업 for a closed business", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => makeNtsResponse("03", "폐업자"),
    } as Response);

    const result = await verifyBusinessNumber("123-45-67890");

    expect(result.valid).toBe(false);
    expect(result.status).toBe("폐업");
  });

  it("accepts 10-digit number without dashes", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => makeNtsResponse("01", "계속사업자"),
    } as Response);

    const result = await verifyBusinessNumber("1234567890");
    expect(result.valid).toBe(true);
  });

  it("throws for invalid business number format", async () => {
    await expect(verifyBusinessNumber("123-456")).rejects.toThrow(
      "Invalid business number format"
    );
    await expect(verifyBusinessNumber("abcdefghij")).rejects.toThrow(
      "Invalid business number format"
    );
  });

  it("throws when DATA_GO_KR_API_KEY is not set", async () => {
    delete process.env.DATA_GO_KR_API_KEY;

    await expect(verifyBusinessNumber("1234567890")).rejects.toThrow(
      "DATA_GO_KR_API_KEY"
    );
  });

  it("returns valid=false when API returns empty data", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status_code: "OK",
        request_cnt: 1,
        valid_cnt: 0,
        data: [],
      }),
    } as Response);

    const result = await verifyBusinessNumber("1234567890");
    expect(result.valid).toBe(false);
    expect(result.status).toBe("폐업");
  });

  it("throws when API returns HTTP error", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as Response);

    await expect(verifyBusinessNumber("1234567890")).rejects.toThrow(
      "NTS API request failed: 500"
    );
  });

  it("sends the correct POST request to NTS API", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => makeNtsResponse("01", "계속사업자"),
    } as Response);

    await verifyBusinessNumber("123-45-67890");

    expect(global.fetch).toHaveBeenCalledOnce();
    const [url, options] = vi.mocked(global.fetch).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toContain("nts-businessman");
    expect(url).toContain("test-api-key");
    expect(options.method).toBe("POST");

    const body = JSON.parse(options.body as string) as { b_no: string[] };
    expect(body.b_no).toEqual(["1234567890"]);
  });
});
