/**
 * REST API source for K-Startup (data.go.kr) public data.
 *
 * Uses the 중소벤처기업부 창업지원사업 공고 API.
 * Requires KSTARTUP_API_KEY (issued from data.go.kr).
 */
import { BaseSource } from "./base-source.js";
import type { CrawledProgram } from "../types.js";

const API_URL =
  "https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01";
const DEFAULT_PAGE_UNIT = 100;
const DEFAULT_MAX_ITEMS = 500;

interface KStartupItem {
  biz_pbanc_nm?: string;
  pbanc_sn?: string | number;
  aply_trgt?: string;
  pbanc_rcpt_bgng_dt?: string;
  pbanc_rcpt_end_dt?: string;
  supt_regin?: string;
  prch_cnpl_no?: string;
  biz_pbanc_dc?: string;
  supt_biz_clsfc?: string;
  biz_pbanc_url?: string;
}

export class KStartupApiSource extends BaseSource {
  readonly name = "kstartup-api";
  private readonly serviceKey: string;

  constructor(serviceKey?: string) {
    super();
    this.serviceKey = serviceKey ?? process.env.KSTARTUP_API_KEY ?? "";
  }

  async crawl(): Promise<CrawledProgram[]> {
    return this.fetchAllPrograms();
  }

  /**
   * Fetches up to `maxItems` programs across multiple pages.
   *
   * Stops early when a page returns fewer items than numOfRows (end of data)
   * or when the cumulative item count reaches `maxItems`.
   */
  async fetchAllPrograms(
    maxItems: number = DEFAULT_MAX_ITEMS,
    pageUnit: number = DEFAULT_PAGE_UNIT,
  ): Promise<CrawledProgram[]> {
    if (!this.serviceKey) {
      throw new Error("KSTARTUP_API_KEY is required");
    }

    const out: CrawledProgram[] = [];
    let pageNo = 1;

    while (out.length < maxItems) {
      const url = new URL(API_URL);
      url.searchParams.set("serviceKey", this.serviceKey);
      url.searchParams.set("pageNo", String(pageNo));
      url.searchParams.set("numOfRows", String(pageUnit));
      url.searchParams.set("type", "json");

      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new Error(`K-Startup API error: ${res.status}`);
      }

      const json = (await res.json()) as Record<string, unknown>;
      const dataWrapper = json?.data as Record<string, unknown> | undefined;
      const items: KStartupItem[] =
        (dataWrapper?.data as KStartupItem[]) ?? [];

      if (items.length === 0) break;

      for (const item of items) {
        out.push(this.toProgram(item));
        if (out.length >= maxItems) break;
      }

      if (items.length < pageUnit) break;
      pageNo += 1;
    }

    return out;
  }

  private toProgram(item: KStartupItem): CrawledProgram {
    const externalId =
      item.pbanc_sn !== undefined && item.pbanc_sn !== null
        ? String(item.pbanc_sn)
        : this.deriveExternalId(item.biz_pbanc_url, item.biz_pbanc_nm);

    return {
      name: item.biz_pbanc_nm ?? "",
      category: "창업",
      applicationStart: this.parseDate(item.pbanc_rcpt_bgng_dt),
      applicationEnd: this.parseDate(item.pbanc_rcpt_end_dt),
      eligibility: item.aply_trgt ?? undefined,
      region: item.supt_regin ?? undefined,
      announcementUrl: item.biz_pbanc_url ?? undefined,
      rawText: item.biz_pbanc_dc ?? undefined,
      externalId,
    };
  }

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
}
