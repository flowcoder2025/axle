/**
 * Crawler persistence service.
 *
 * Takes CrawledProgram[] from an external source (bizinfo/kstartup public APIs)
 * and upserts them into ProgramInfo while writing a single AutomationLog entry
 * per source. Handles exponential-backoff retries (1s / 2s / 4s) for transient
 * fetch failures.
 *
 * WI-211-212-213
 */

import { prisma } from "@axle/db";
import { Prisma } from "@prisma/client";
import type { CrawledProgram } from "@axle/crawler";

export type ProgramSource = "bizinfo" | "kstartup";

type PrismaCategory =
  | "STARTUP"
  | "VENTURE"
  | "RND"
  | "CERTIFICATION"
  | "EXPORT"
  | "SMART_FACTORY"
  | "GENERAL";

export interface CrawlerSourceResult {
  source: ProgramSource;
  imported: number;
  updated: number;
  failed: number;
  duration: number;
  error?: string;
}

export interface CrawlerRunResult {
  sources: CrawlerSourceResult[];
  totalDuration: number;
}

/**
 * Maps a raw category string (from source APIs) into the ProgramCategory enum
 * used by Prisma. Unknown categories fall back to GENERAL.
 */
export function mapToProgramCategory(raw?: string): PrismaCategory {
  if (!raw) return "GENERAL";
  const normalized = raw.trim();
  const table: Record<string, PrismaCategory> = {
    창업: "STARTUP",
    "R&D": "RND",
    RD: "RND",
    수출: "EXPORT",
    고용: "GENERAL",
    금융: "GENERAL",
    마케팅: "GENERAL",
    컨설팅: "GENERAL",
    기타: "GENERAL",
    벤처: "VENTURE",
    인증: "CERTIFICATION",
    스마트공장: "SMART_FACTORY",
  };
  return table[normalized] ?? "GENERAL";
}

/**
 * Retries an async operation with exponential backoff. Delays are configurable
 * for testability (tests pass `[0, 0, 0]` to avoid real waits).
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  delaysMs: number[] = [1_000, 2_000, 4_000],
): Promise<T> {
  let lastErr: unknown;
  const maxAttempts = delaysMs.length + 1;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < delaysMs.length) {
        const wait = delaysMs[attempt] ?? 0;
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastErr;
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Upserts a single CrawledProgram into ProgramInfo using `(source, externalId)`
 * as the unique key. Returns whether the row was newly created or updated.
 */
export async function upsertCrawledProgram(
  source: ProgramSource,
  program: CrawledProgram,
  prismaClient: typeof prisma = prisma,
): Promise<"created" | "updated"> {
  if (!program.externalId) {
    // Without a stable externalId we cannot deduplicate, so skip.
    throw new Error("CrawledProgram missing externalId");
  }

  const now = new Date();
  const category = mapToProgramCategory(program.category);
  const applicationStart = parseDate(program.applicationStart);
  const applicationEnd = parseDate(program.applicationEnd);

  const commonData = {
    name: program.name,
    agency: program.agency ?? null,
    category,
    announcementUrl: program.announcementUrl ?? null,
    applicationStart,
    applicationEnd,
    region: program.region ?? null,
    eligibility: program.eligibility
      ? ({ raw: program.eligibility } as Prisma.InputJsonValue)
      : Prisma.JsonNull,
    requirements: program.rawText
      ? ({ summary: program.rawText } as Prisma.InputJsonValue)
      : Prisma.JsonNull,
    maxFunding: program.maxFunding ?? null,
    isCrawled: true,
    crawledAt: now,
    source,
  };

  const existing = await prismaClient.programInfo.findUnique({
    where: { source_externalId: { source, externalId: program.externalId } },
    select: { id: true },
  });

  if (existing) {
    await prismaClient.programInfo.update({
      where: { id: existing.id },
      data: commonData,
    });
    return "updated";
  }

  await prismaClient.programInfo.create({
    data: {
      ...commonData,
      externalId: program.externalId,
      orgId: null,
    },
  });
  return "created";
}

/**
 * Runs a single source end-to-end:
 *  1. fetch with exponential-backoff retries (3 attempts max)
 *  2. upsert each program
 *  3. write a single AutomationLog entry
 *
 * A failure in one source does NOT abort the caller — the caller iterates
 * sources independently.
 */
export async function runAndPersistSource(params: {
  source: ProgramSource;
  fetch: () => Promise<CrawledProgram[]>;
  prismaClient?: typeof prisma;
  retryDelaysMs?: number[];
}): Promise<CrawlerSourceResult> {
  const {
    source,
    fetch: fetchFn,
    prismaClient = prisma,
    retryDelaysMs,
  } = params;
  const startedAt = Date.now();
  let imported = 0;
  let updated = 0;
  let failed = 0;
  let errorMessage: string | undefined;

  try {
    const programs = await retryWithBackoff(fetchFn, retryDelaysMs);

    for (const p of programs) {
      try {
        const res = await upsertCrawledProgram(source, p, prismaClient);
        if (res === "created") imported += 1;
        else updated += 1;
      } catch (err) {
        failed += 1;
        console.error(
          `crawler-persist: upsert failed for ${source} externalId=${p.externalId ?? "?"}:`,
          err,
        );
      }
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  const duration = Date.now() - startedAt;
  const status: "COMPLETED" | "FAILED" = errorMessage ? "FAILED" : "COMPLETED";

  await prismaClient.automationLog.create({
    data: {
      clientId: null,
      type: "CRAWL",
      target: source,
      status,
      errorMessage: errorMessage ?? null,
      detail: {
        source,
        imported,
        updated,
        failed,
        duration,
      } as Prisma.InputJsonValue,
    },
  });

  return {
    source,
    imported,
    updated,
    failed,
    duration,
    error: errorMessage,
  };
}
