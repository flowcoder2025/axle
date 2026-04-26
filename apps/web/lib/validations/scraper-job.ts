import { z } from "zod";

export const SCRAPER_JOB_TYPES = ["HOMETAX_ISSUE", "MINWON24_ISSUE", "INSURANCE_ISSUE"] as const;
export const CREDENTIALS_KINDS = ["CERTIFICATE", "USERPW"] as const;

export const scraperJobCreateSchema = z.object({
  clientId: z.string().min(1),
  type: z.enum(SCRAPER_JOB_TYPES),
  target: z.string().min(1).max(200),
  params: z.record(z.string(), z.unknown()).optional(),
  credentialsRef: z.string().min(1),
  credentialsKind: z.enum(CREDENTIALS_KINDS),
});

export type ScraperJobCreateInput = z.infer<typeof scraperJobCreateSchema>;

export const SCRAPER_RESULT_STATUSES = ["COMPLETED", "FAILED"] as const;
export const SCRAPER_ERROR_CODES = [
  "LOGIN_FAILED",
  "TIMEOUT",
  "SELECTOR_MISSING",
  "NETWORK",
  "UNKNOWN",
] as const;

export const scraperResultMetadataSchema = z.object({
  jobId: z.string().min(1),
  status: z.enum(SCRAPER_RESULT_STATUSES),
  errorCode: z.enum(SCRAPER_ERROR_CODES).optional(),
  errorMessage: z.string().max(2000).optional(),
  detail: z.record(z.string(), z.unknown()).optional(),
  durationMs: z.number().int().nonnegative().optional(),
});

export type ScraperResultMetadata = z.infer<typeof scraperResultMetadataSchema>;

export const PORTAL_KINDS = ["HOMETAX", "MINWON24", "INSURANCE"] as const;
export const REPAIR_TIERS = ["tier1", "tier2"] as const;

export const scraperRepairSchema = z.object({
  jobId: z.string().optional(),
  portal: z.enum(PORTAL_KINDS),
  page: z.string().min(1).max(200),
  element: z.string().min(1).max(200),
  oldSelector: z.string().min(1).max(2000),
  newSelector: z.string().min(1).max(2000),
  repairedBy: z.enum(REPAIR_TIERS),
  /** base64 png; max ~500KB raw before encoding */
  screenshotBase64: z
    .string()
    .max(800_000)
    .optional(),
});

export type ScraperRepairInput = z.infer<typeof scraperRepairSchema>;

export const scraperReportSchema = z.object({
  scraperInstanceId: z.string().min(1).max(200),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  jobsProcessed: z.number().int().nonnegative(),
  jobsSucceeded: z.number().int().nonnegative(),
  jobsFailed: z.number().int().nonnegative(),
  repairsTriggered: z.number().int().nonnegative().default(0),
  version: z.string().min(1).max(80),
});

export type ScraperReportInput = z.infer<typeof scraperReportSchema>;
