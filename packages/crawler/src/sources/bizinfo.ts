/**
 * Crawler for 기업마당 (bizinfo.go.kr) — government support program listings.
 *
 * Phase 8: implements page navigation and basic data extraction.
 * Selector self-repair is wired via tryWithRepair().
 */
import { BaseSource } from "./base-source.js";
import { getBrowser } from "../browser.js";
import { tryWithRepair } from "../self-repair.js";
import type { CrawledProgram } from "../types.js";

const BASE_URL = "https://www.bizinfo.go.kr";
const LIST_URL = `${BASE_URL}/web/lay1/bbs/S1T122C128/AS/74/list.do`;

/** Maximum pages to crawl per run (keeps execution time bounded). */
const MAX_PAGES = 5;

export class BizinfoSource extends BaseSource {
  readonly name = "bizinfo.go.kr";

  async crawl(): Promise<CrawledProgram[]> {
    const browser = await getBrowser();
    const page = await browser.newPage();
    const programs: CrawledProgram[] = [];

    try {
      await page.goto(LIST_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });

      for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
        const items = await this.extractListItems(page);
        programs.push(...items);

        const hasNext = await this.goToNextPage(page, pageNum);
        if (!hasNext) break;
      }
    } finally {
      await page.close();
    }

    return programs;
  }

  private async extractListItems(
    page: import("../types.js").PageLike
  ): Promise<CrawledProgram[]> {
    const programs: CrawledProgram[] = [];

    // Try to locate program row elements.
    const rowSelector = "table.tbl_list tbody tr";
    const rows = await page.$$(rowSelector);

    for (const row of rows) {
      try {
        const titleEl = await row.$("td.subject a, td:nth-child(2) a");
        const name = (await titleEl?.textContent())?.trim() ?? "";
        if (!name) continue;

        const href = (await titleEl?.getAttribute("href")) ?? "";
        const announcementUrl = href
          ? href.startsWith("http")
            ? href
            : `${BASE_URL}${href}`
          : undefined;

        const agencyEl = await row.$("td:nth-child(3), td.agency");
        const agency = (await agencyEl?.textContent())?.trim() || undefined;

        const endDateEl = await row.$("td:nth-child(5), td.end-date");
        const applicationEnd = (await endDateEl?.textContent())?.trim() || undefined;

        programs.push({ name, agency, applicationEnd, announcementUrl });
      } catch {
        // Skip malformed rows silently; errors are reported at the worker level.
      }
    }

    return programs;
  }

  private async goToNextPage(
    page: import("../types.js").PageLike,
    currentPage: number
  ): Promise<boolean> {
    const nextSelector = `a.next, .paging a[title="다음"], .pagination a:contains("다음")`;

    const moved = await tryWithRepair(
      page,
      nextSelector,
      "pagination next-page button",
      async (el) => {
        const href = await el.getAttribute("href");
        if (href && href !== "#") {
          const nextUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;
          await page.goto(nextUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
        }
      }
    );

    void currentPage; // used by caller for MAX_PAGES guard
    return moved;
  }
}
