import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { executeCrawl, AVAILABLE_SOURCES } from "../src/worker.js";
import { setBrowser, closeBrowser } from "../src/browser.js";
import type { BrowserLike, ElementHandleLike, PageLike } from "../src/types.js";

// ---------------------------------------------------------------------------
// Mock browser helpers
// ---------------------------------------------------------------------------

function makeEl(text: string, attrs: Record<string, string> = {}): ElementHandleLike {
  return {
    textContent: async () => text,
    getAttribute: async (name: string) => attrs[name] ?? null,
    $$: async () => [],
    $: async () => null,
  };
}

function makeRow(name: string, agency: string, href: string): ElementHandleLike {
  const titleEl = makeEl(name, { href });
  const agencyEl = makeEl(agency);
  return {
    textContent: async () => name,
    getAttribute: async () => null,
    $$: async () => [],
    $: async (selector: string) => {
      if (selector.includes("subject") || selector.includes("nth-child(2)")) return titleEl;
      if (selector.includes("nth-child(3)") || selector.includes("agency")) return agencyEl;
      return null;
    },
  };
}

function makePage(rows: ElementHandleLike[]): PageLike {
  return {
    goto: vi.fn().mockResolvedValue(null),
    waitForSelector: vi.fn().mockResolvedValue(null),
    $$: vi.fn().mockImplementation((selector: string) => {
      if (selector.includes("tbody tr")) return Promise.resolve(rows);
      return Promise.resolve([]);
    }),
    $: vi.fn().mockResolvedValue(null), // no next-page button → single page
    screenshot: vi.fn().mockResolvedValue(""),
    url: () => "https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do",
    close: vi.fn().mockResolvedValue(undefined),
  };
}

function makeBrowser(page: PageLike): BrowserLike {
  return {
    newPage: async () => page,
    close: vi.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AVAILABLE_SOURCES", () => {
  it("contains bizinfo", () => {
    expect(AVAILABLE_SOURCES).toContain("bizinfo");
  });
});

describe("executeCrawl", () => {
  let page: PageLike;

  beforeEach(() => {
    page = makePage([
      makeRow("스마트 제조 R&D 지원", "중소벤처기업부", "/program/1"),
      makeRow("수출 바우처", "KOTRA", "/program/2"),
    ]);
    setBrowser(makeBrowser(page));
  });

  afterEach(async () => {
    await closeBrowser();
  });

  it("returns one CrawlResult per source", async () => {
    const results = await executeCrawl(["bizinfo"]);
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe("bizinfo");
  });

  it("populates programs from mock rows", async () => {
    const [result] = await executeCrawl(["bizinfo"]);
    expect(result.programs.length).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it("sets crawledAt as a Date", async () => {
    const [result] = await executeCrawl(["bizinfo"]);
    expect(result.crawledAt).toBeInstanceOf(Date);
  });

  it("reports error for unknown source", async () => {
    const results = await executeCrawl(["nonexistent"]);
    expect(results[0].errors).toHaveLength(1);
    expect(results[0].errors[0].message).toMatch(/Unknown source/);
  });

  it("normalizes programs (deduplication + categorization)", async () => {
    const dupPage = makePage([
      makeRow("R&D 지원사업", "기관A", "/p/1"),
      makeRow("R&D 지원사업", "기관B", "/p/2"), // duplicate
    ]);
    setBrowser(makeBrowser(dupPage));

    const [result] = await executeCrawl(["bizinfo"]);
    // After dedup, only one program
    const rdPrograms = result.programs.filter((p) => p.name === "R&D 지원사업");
    expect(rdPrograms).toHaveLength(1);
  });

  it("handles source crawl errors gracefully", async () => {
    const errorPage: PageLike = {
      goto: vi.fn().mockRejectedValue(new Error("Network timeout")),
      waitForSelector: vi.fn().mockResolvedValue(null),
      $$: vi.fn().mockResolvedValue([]),
      $: vi.fn().mockResolvedValue(null),
      screenshot: vi.fn().mockResolvedValue(""),
      url: () => "https://www.bizinfo.go.kr/",
      close: vi.fn().mockResolvedValue(undefined),
    };
    setBrowser(makeBrowser(errorPage));

    const [result] = await executeCrawl(["bizinfo"]);
    expect(result.programs).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toMatch(/Network timeout/);
  });

  it("runs all sources when called with no arguments", async () => {
    const results = await executeCrawl();
    expect(results).toHaveLength(AVAILABLE_SOURCES.length);
  });
});
