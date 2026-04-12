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

interface KStartupItem {
  biz_pbanc_nm?: string;
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
    if (!this.serviceKey) {
      throw new Error("KSTARTUP_API_KEY is required");
    }

    const url = new URL(API_URL);
    url.searchParams.set("serviceKey", this.serviceKey);
    url.searchParams.set("pageNo", "1");
    url.searchParams.set("numOfRows", "100");
    url.searchParams.set("type", "json");

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`K-Startup API error: ${res.status}`);
    }

    const json = (await res.json()) as Record<string, unknown>;
    const dataWrapper = json?.data as Record<string, unknown> | undefined;
    const items: KStartupItem[] =
      (dataWrapper?.data as KStartupItem[]) ?? [];

    return items.map((item) => this.toProgram(item));
  }

  private toProgram(item: KStartupItem): CrawledProgram {
    return {
      name: item.biz_pbanc_nm ?? "",
      category: "창업",
      applicationStart: this.parseDate(item.pbanc_rcpt_bgng_dt),
      applicationEnd: this.parseDate(item.pbanc_rcpt_end_dt),
      eligibility: item.aply_trgt ?? undefined,
      region: item.supt_regin ?? undefined,
      announcementUrl: item.biz_pbanc_url ?? undefined,
      rawText: item.biz_pbanc_dc ?? undefined,
    };
  }

  private parseDate(dateStr?: string): string | undefined {
    if (!dateStr || dateStr.length < 8) return undefined;
    const clean = dateStr.replace(/[^0-9]/g, "");
    if (clean.length !== 8) return undefined;
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
  }
}
