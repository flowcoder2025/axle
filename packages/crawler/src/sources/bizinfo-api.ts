/**
 * REST API source for 기업마당 (bizinfo.go.kr) public data.
 *
 * Uses the official 기업마당 공공API (bizinfoApi.do) instead of browser scraping.
 * Requires a BIZINFO_API_KEY (issued from data.go.kr or bizinfo.go.kr).
 */
import { BaseSource } from "./base-source.js";
import type { CrawledProgram } from "../types.js";

const API_URL = "https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do";
const DEFAULT_PAGE_UNIT = 100;
const DEFAULT_MAX_ITEMS = 500;

interface BizinfoItem {
  title?: string;
  pblancNm?: string;
  pblancId?: string;
  jrsdInsttNm?: string;
  author?: string;
  bsnsSumryCn?: string;
  description?: string;
  pldirSportRealmLclasCodeNm?: string;
  lcategory?: string;
  reqstBeginEndDe?: string;
  reqstDt?: string;
  trgetNm?: string;
  link?: string;
  hashTags?: string;
}

export class BizinfoApiSource extends BaseSource {
  readonly name = "bizinfo-api";
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    super();
    this.apiKey = apiKey ?? process.env.BIZINFO_API_KEY ?? "";
  }

  async crawl(): Promise<CrawledProgram[]> {
    return this.fetchAllPrograms();
  }

  /**
   * Fetches up to `maxItems` programs across multiple pages.
   *
   * Stops early when a page returns fewer items than pageUnit (end of data)
   * or when the cumulative item count reaches `maxItems`.
   */
  async fetchAllPrograms(
    maxItems: number = DEFAULT_MAX_ITEMS,
    pageUnit: number = DEFAULT_PAGE_UNIT,
  ): Promise<CrawledProgram[]> {
    if (!this.apiKey) {
      throw new Error("BIZINFO_API_KEY is required");
    }

    const out: CrawledProgram[] = [];
    let pageIndex = 1;

    while (out.length < maxItems) {
      const url = new URL(API_URL);
      url.searchParams.set("crtfcKey", this.apiKey);
      url.searchParams.set("dataType", "json");
      url.searchParams.set("pageUnit", String(pageUnit));
      url.searchParams.set("pageIndex", String(pageIndex));

      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new Error(`Bizinfo API error: ${res.status}`);
      }

      const json = (await res.json()) as Record<string, unknown>;
      const items: BizinfoItem[] =
        (json?.jsonArray as BizinfoItem[]) ?? (json?.items as BizinfoItem[]) ?? [];

      if (items.length === 0) break;

      for (const item of items) {
        out.push(this.toProgram(item));
        if (out.length >= maxItems) break;
      }

      if (items.length < pageUnit) break;
      pageIndex += 1;
    }

    return out;
  }

  private toProgram(item: BizinfoItem): CrawledProgram {
    const name = item.pblancNm ?? item.title ?? "";
    const agency = item.jrsdInsttNm ?? item.author ?? undefined;
    const category = this.mapCategory(
      item.pldirSportRealmLclasCodeNm ?? item.lcategory,
    );

    // Parse date range "20260401~20260430" format
    const dateRange = item.reqstBeginEndDe ?? item.reqstDt ?? "";
    const [startStr, endStr] = dateRange.split("~").map((s) => s.trim());

    const applicationStart = this.parseDate(startStr);
    const applicationEnd = this.parseDate(endStr);

    const externalId = item.pblancId ?? this.deriveExternalId(item.link, name);

    return {
      name,
      agency,
      category,
      applicationStart,
      applicationEnd,
      eligibility: item.trgetNm ?? undefined,
      announcementUrl: item.link ?? undefined,
      rawText: item.bsnsSumryCn ?? item.description ?? undefined,
      externalId,
    };
  }

  /**
   * Derives a stable externalId from link or name when pblancId is missing.
   * Links typically contain a numeric id (e.g. /detail/1234).
   */
  private deriveExternalId(link?: string, name?: string): string | undefined {
    if (link) {
      const match = link.match(/(\d+)(?!.*\d)/);
      if (match) return `link-${match[1]}`;
    }
    if (name) {
      return `name-${name.replace(/\s+/g, "-").slice(0, 80)}`;
    }
    return undefined;
  }

  private parseDate(dateStr?: string): string | undefined {
    if (!dateStr || dateStr.length < 8) return undefined;
    const clean = dateStr.replace(/[^0-9]/g, "");
    if (clean.length !== 8) return undefined;
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
  }

  private mapCategory(raw?: string): string | undefined {
    if (!raw) return undefined;
    const map: Record<string, string> = {
      창업: "창업",
      기술: "R&D",
      수출: "수출",
      인력: "고용",
      자금: "금융",
      내수: "마케팅",
      경영: "컨설팅",
    };
    for (const [key, val] of Object.entries(map)) {
      if (raw.includes(key)) return val;
    }
    return "기타";
  }
}
