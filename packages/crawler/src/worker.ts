/**
 * Crawler worker — orchestrates the full crawl pipeline.
 *
 * executeCrawl(sources?) → select sources → crawl each → normalize → CrawlResult[]
 */
import { BizinfoSource } from "./sources/bizinfo.js";
import { normalizePrograms } from "./normalizer.js";
import { closeBrowser } from "./browser.js";
import type { CrawlError, CrawlResult } from "./types.js";
import type { BaseSource } from "./sources/base-source.js";

/** Registry of available source names → factory functions. */
const SOURCE_REGISTRY: Record<string, () => BaseSource> = {
  bizinfo: () => new BizinfoSource(),
};

/** All registered source names. */
export const AVAILABLE_SOURCES = Object.keys(SOURCE_REGISTRY);

/**
 * Runs the crawl pipeline for the specified sources (defaults to all).
 *
 * 1. Selects source instances.
 * 2. Crawls each source, capturing errors per-source.
 * 3. Normalizes (deduplicate, parse dates/funding, categorize).
 * 4. Returns one CrawlResult per source.
 *
 * The browser singleton is NOT closed here — call closeBrowser() explicitly
 * when you are done with all crawl runs (e.g. in process teardown).
 */
export async function executeCrawl(sources?: string[]): Promise<CrawlResult[]> {
  const selectedNames = sources ?? AVAILABLE_SOURCES;
  const results: CrawlResult[] = [];

  for (const name of selectedNames) {
    const factory = SOURCE_REGISTRY[name];
    if (!factory) {
      results.push({
        programs: [],
        errors: [
          {
            source: name,
            message: `Unknown source: "${name}". Available: ${AVAILABLE_SOURCES.join(", ")}`,
            occurredAt: new Date(),
          },
        ],
        source: name,
        crawledAt: new Date(),
      });
      continue;
    }

    const source = factory();
    const errors: CrawlError[] = [];
    let programs: CrawlResult["programs"] = [];

    try {
      const raw = await source.crawl();
      programs = normalizePrograms(raw);
    } catch (err) {
      errors.push({
        source: name,
        message: err instanceof Error ? err.message : String(err),
        occurredAt: new Date(),
      });
    }

    results.push({
      programs,
      errors,
      source: name,
      crawledAt: new Date(),
    });
  }

  return results;
}

/**
 * Convenience wrapper: crawl + close browser when done.
 * Use this for one-shot CLI invocations.
 */
export async function executeCrawlAndClose(sources?: string[]): Promise<CrawlResult[]> {
  try {
    return await executeCrawl(sources);
  } finally {
    await closeBrowser();
  }
}
