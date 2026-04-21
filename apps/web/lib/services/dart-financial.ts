/**
 * DART OpenAPI Integration
 * https://opendart.fss.or.kr
 *
 * - fetchDartFinancials / fetchAnnualFinancials — Annual financial statements
 * - fetchCompanyCodes — Cached CORPCODE catalogue (24h in-process memory)
 * - findCorpCodeByBusinessNumber — Resolve corp_code by business number or name match
 *
 * DART의 `corpCode.xml` 다운로드는 ZIP(`PK..`) 컨테이너로 내려오므로 jszip 으로 풀어
 * `corp_code / corp_name / corp_eng_name / stock_code / modify_date` 필드를 파싱합니다.
 *
 * Creates an AutomationLog on each fetchAnnualFinancials execution.
 */

import { prisma } from "@axle/db";
import JSZip from "jszip";

const DART_BASE_URL = "https://opendart.fss.or.kr/api";
const DART_CORPCODE_URL = `${DART_BASE_URL}/corpCode.xml`;
const CORP_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export interface DartCompanyCode {
  name: string;
  corpCode: string;
  stockCode: string | null;
}

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

// ---- CORPCODE cache ---------------------------------------------------------

interface CorpCache {
  fetchedAt: number;
  list: DartCompanyCode[];
}

// In-process memory cache. On serverless (Vercel) each cold instance reloads,
// which is acceptable — DART publishes CORPCODE at most daily.
let corpCache: CorpCache | null = null;

export function __resetCorpCache() {
  // Exported for testing only.
  corpCache = null;
}

function assertApiKey(): string {
  const apiKey = process.env.DART_API_KEY;
  if (!apiKey) {
    throw new Error("DART_API_KEY environment variable is not set");
  }
  return apiKey;
}

/**
 * Parses DART corpCode.xml into a list of companies.
 * Uses a lightweight line-based regex parser to avoid pulling in a full XML dep.
 */
function parseCorpCodeXml(xml: string): DartCompanyCode[] {
  const out: DartCompanyCode[] = [];
  const listRegex = /<list>([\s\S]*?)<\/list>/g;
  const nameRegex = /<corp_name>([\s\S]*?)<\/corp_name>/;
  const codeRegex = /<corp_code>([\s\S]*?)<\/corp_code>/;
  const stockRegex = /<stock_code>([\s\S]*?)<\/stock_code>/;

  let match: RegExpExecArray | null;
  while ((match = listRegex.exec(xml)) !== null) {
    const block = match[1];
    const nameMatch = nameRegex.exec(block);
    const codeMatch = codeRegex.exec(block);
    const stockMatch = stockRegex.exec(block);
    if (!nameMatch || !codeMatch) continue;

    const stockRaw = stockMatch?.[1]?.trim() ?? "";
    out.push({
      name: nameMatch[1].trim(),
      corpCode: codeMatch[1].trim(),
      stockCode: stockRaw.length > 0 ? stockRaw : null,
    });
  }
  return out;
}

/**
 * Downloads and parses the DART company code catalogue.
 * Cached in-process for 24h.
 */
export async function fetchCompanyCodes(options?: {
  force?: boolean;
}): Promise<DartCompanyCode[]> {
  if (
    !options?.force &&
    corpCache &&
    Date.now() - corpCache.fetchedAt < CORP_CACHE_TTL_MS
  ) {
    return corpCache.list;
  }

  const apiKey = assertApiKey();
  const url = new URL(DART_CORPCODE_URL);
  url.searchParams.set("crtfc_key", apiKey);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/zip,application/octet-stream" },
  });
  if (!res.ok) {
    throw new Error(
      `DART CORPCODE HTTP error: ${res.status} ${res.statusText}`
    );
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const zip = await JSZip.loadAsync(buf);
  const xmlEntry =
    zip.file("CORPCODE.xml") ?? zip.file(/CORPCODE\.xml$/i)[0] ?? null;
  if (!xmlEntry) {
    throw new Error("CORPCODE.xml not found in DART archive");
  }
  const xml = await xmlEntry.async("string");
  const list = parseCorpCodeXml(xml);

  corpCache = { fetchedAt: Date.now(), list };
  return list;
}

function normalizeCompanyName(raw: string): string {
  return raw
    .replace(/\s+/g, "")
    .replace(/[()\\[\\]]/g, "")
    .replace(/주식회사|㈜|\(주\)|inc\.?|corp\.?|ltd\.?|co\.?/gi, "")
    .toLowerCase();
}

/**
 * DART 의 corp_code 는 기업 고유코드로, 사업자등록번호와 직접 매핑되지 않습니다.
 * 따라서 1차로 stockCode 가 있는 상장사에서 name 근사 매칭을,
 * 2차로 전체 목록에서 name 완전/접두 매칭을 수행합니다.
 *
 * @param businessNumberOrName 사업자등록번호(10자리) 또는 회사명
 * @param corpList             fetchCompanyCodes 결과
 */
export function findCorpCodeByBusinessNumber(
  businessNumberOrName: string,
  corpList: DartCompanyCode[],
  fallbackName?: string
): DartCompanyCode | null {
  const candidates = [businessNumberOrName, fallbackName]
    .filter((s): s is string => !!s && s.trim().length > 0)
    .map((s) => s.trim());

  // Business number (10 digits) has no direct mapping in CORPCODE.xml,
  // so only name-based lookup is possible. If the input is a bizno and no
  // fallbackName is supplied, return null (caller should provide name).
  for (const raw of candidates) {
    if (/^\d{10}$/.test(raw)) continue; // skip pure bizno — not mappable
    const target = normalizeCompanyName(raw);
    if (!target) continue;

    // 1) exact normalized match
    const exact = corpList.find(
      (c) => normalizeCompanyName(c.name) === target
    );
    if (exact) return exact;

    // 2) prefix match among listed companies (prioritise listed = stockCode)
    const listedPrefix = corpList.find(
      (c) => c.stockCode && normalizeCompanyName(c.name).startsWith(target)
    );
    if (listedPrefix) return listedPrefix;

    // 3) any prefix match
    const anyPrefix = corpList.find((c) =>
      normalizeCompanyName(c.name).startsWith(target)
    );
    if (anyPrefix) return anyPrefix;
  }

  return null;
}

// ---- Financial statements ---------------------------------------------------

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
function mapDartItems(
  items: DartFinancialItem[]
): Omit<DartFinancialData, "year" | "source"> {
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
 * Fetches DART financials for a listed company and writes an AutomationLog.
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
  const apiKey = assertApiKey();

  const url = new URL(`${DART_BASE_URL}/fnlttSinglAcntAll.json`);
  url.searchParams.set("crtfc_key", apiKey);
  url.searchParams.set("corp_code", corpCode);
  url.searchParams.set("bsns_year", String(year));
  url.searchParams.set("reprt_code", "11011"); // 사업보고서
  url.searchParams.set("fs_div", "CFS");

  let status: "COMPLETED" | "FAILED" = "FAILED";
  let resultUrl: string | undefined;
  let errorMessage: string | undefined;

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
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

/**
 * Alias kept for readability in task specification (WI-227).
 * Equivalent to fetchDartFinancials(corpCode, year).
 */
export async function fetchAnnualFinancials(
  corpCode: string,
  year: number,
  clientId?: string
): Promise<DartFinancialData> {
  return fetchDartFinancials(corpCode, year, clientId);
}
