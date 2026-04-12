/**
 * REST API source for 기업마당 (bizinfo.go.kr) public data.
 *
 * Uses the official 기업마당 공공API (bizinfoApi.do) instead of browser scraping.
 * Requires a BIZINFO_API_KEY (issued from data.go.kr or bizinfo.go.kr).
 */
import { BaseSource } from "./base-source.js";
import type { CrawledProgram } from "../types.js";

const API_URL = "https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do";

interface BizinfoItem {
  title?: string;
  pblancNm?: string;
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
    if (!this.apiKey) {
      throw new Error("BIZINFO_API_KEY is required");
    }

    const url = new URL(API_URL);
    url.searchParams.set("crtfcKey", this.apiKey);
    url.searchParams.set("dataType", "json");
    url.searchParams.set("pageUnit", "100");
    url.searchParams.set("pageIndex", "1");

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Bizinfo API error: ${res.status}`);
    }

    const json = await res.json();
    const items: BizinfoItem[] = json?.jsonArray ?? json?.items ?? [];

    return items.map((item) => this.toProgram(item));
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

    return {
      name,
      agency,
      category,
      applicationStart,
      applicationEnd,
      eligibility: item.trgetNm ?? undefined,
      announcementUrl: item.link ?? undefined,
      rawText: item.bsnsSumryCn ?? item.description ?? undefined,
    };
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
