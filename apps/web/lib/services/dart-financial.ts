/**
 * DART OpenAPI Integration
 * https://opendart.fss.or.kr
 *
 * fetchDartFinancials — Fetches listed company financial data and maps it
 * to the ClientFinancial shape. Creates an AutomationLog on each execution.
 */

import { prisma } from "@axle/db";

const DART_BASE_URL = "https://opendart.fss.or.kr/api";

export interface DartFinancialData {
  year: number;
  revenue?: number;
  operatingProfit?: number;
  netProfit?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  totalEquity?: number;
  source: string;
}

interface DartFinancialItem {
  account_nm: string;
  thstrm_amount?: string;
  fs_div?: string;
  sj_div?: string;
}

interface DartFinancialResponse {
  status: string;
  message: string;
  list?: DartFinancialItem[];
}

/**
 * Safely parses a Korean DART amount string (may have commas, may be negative).
 */
function parseDartAmount(raw?: string): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw.replace(/,/g, ""));
  return isNaN(n) ? undefined : n;
}

/**
 * Maps DART account names to our schema fields.
 * Uses consolidated (CFS) financials when available, falls back to separate (OFS).
 */
function mapDartItems(items: DartFinancialItem[]): Omit<DartFinancialData, "year" | "source"> {
  // Prefer CFS (연결재무제표); fallback to OFS (개별재무제표)
  const preferred = items.filter((i) => i.fs_div === "CFS");
  const source = preferred.length > 0 ? preferred : items.filter((i) => i.fs_div === "OFS");

  const find = (accountNm: string) =>
    source.find((i) => i.account_nm === accountNm)?.thstrm_amount;

  return {
    revenue: parseDartAmount(find("매출액")),
    operatingProfit: parseDartAmount(find("영업이익")),
    netProfit: parseDartAmount(find("당기순이익")),
    totalAssets: parseDartAmount(find("자산총계")),
    totalLiabilities: parseDartAmount(find("부채총계")),
    totalEquity: parseDartAmount(find("자본총계")),
  };
}

/**
 * Fetches DART financials for a listed company.
 *
 * @param corpCode - DART corporation code (8-digit string)
 * @param year     - Business year (e.g., 2023)
 * @param clientId - Optional AXLE clientId for AutomationLog association
 */
export async function fetchDartFinancials(
  corpCode: string,
  year: number,
  clientId?: string
): Promise<DartFinancialData> {
  const apiKey = process.env.DART_API_KEY;
  if (!apiKey) {
    throw new Error("DART_API_KEY environment variable is not set");
  }

  const url = new URL(`${DART_BASE_URL}/fnlttSinglAcntAll.json`);
  url.searchParams.set("crtfc_key", apiKey);
  url.searchParams.set("corp_code", corpCode);
  url.searchParams.set("bsns_year", String(year));
  url.searchParams.set("reprt_code", "11011"); // 사업보고서

  let status: "COMPLETED" | "FAILED" = "FAILED";
  let resultUrl: string | undefined;
  let errorMessage: string | undefined;

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 }, // no caching — always fresh
    });

    if (!res.ok) {
      throw new Error(`DART API HTTP error: ${res.status} ${res.statusText}`);
    }

    const json: DartFinancialResponse = await res.json();

    if (json.status !== "000") {
      throw new Error(`DART API error: ${json.status} — ${json.message}`);
    }

    const items = json.list ?? [];
    const mapped = mapDartItems(items);

    status = "COMPLETED";
    resultUrl = url.toString();

    return {
      year,
      source: `DART:${corpCode}:${year}`,
      ...mapped,
    };
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    // Always log the execution
    await prisma.automationLog.create({
      data: {
        clientId: clientId ?? null,
        type: "DART_FETCH",
        target: `${corpCode}:${year}`,
        status,
        resultUrl: resultUrl ?? null,
        errorMessage: errorMessage ?? null,
      },
    });
  }
}
