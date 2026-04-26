import { put } from "@vercel/blob";

/**
 * Vercel Blob upload helper for scraper results.
 *
 * Path convention (per .flowset/contracts/scraper-data.md §3):
 *   scraper/{orgId}/{yyyy-mm}/{jobId}/{target}.pdf
 *
 * Access: `public` — Vercel Blob URLs include a 16-byte random suffix
 * making them effectively unguessable. Application-level access control
 * happens at the API route layer (session check before returning URL).
 *
 * BLOB_READ_WRITE_TOKEN is auto-injected by Vercel runtime.
 * For local dev: `vercel env pull .env.local`.
 */

export interface ScraperBlobUploadInput {
  orgId: string;
  jobId: string;
  /** Human-readable filename without extension, e.g. "납세증명서". */
  target: string;
  /** PDF binary. */
  body: Buffer | ArrayBuffer | Blob;
  /** Override content type (default application/pdf). */
  contentType?: string;
  /** Override path date (default = now). Useful for tests. */
  now?: Date;
}

export interface ScraperBlobUploadResult {
  url: string;
  pathname: string;
  contentType: string;
  size: number;
}

const SAFE_FILENAME_FALLBACK = "result";
const SEPARATOR_PATTERN = /[\s/\\]+/g;
const TRIM_UNDERSCORES = /^_+|_+$/g;

function sanitizePathSegment(value: string): string {
  // Replace whitespace, forward slash, backslash with underscore.
  // Keep Korean / unicode letters intact (Vercel Blob path is unicode-safe).
  const replaced = value.replace(SEPARATOR_PATTERN, "_").replace(TRIM_UNDERSCORES, "");
  return replaced || SAFE_FILENAME_FALLBACK;
}

function yyyymm(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function uploadScraperResult(
  input: ScraperBlobUploadInput,
): Promise<ScraperBlobUploadResult> {
  const orgSeg = sanitizePathSegment(input.orgId);
  const jobSeg = sanitizePathSegment(input.jobId);
  const targetSeg = sanitizePathSegment(input.target);
  const period = yyyymm(input.now ?? new Date());

  const pathname = `scraper/${orgSeg}/${period}/${jobSeg}/${targetSeg}.pdf`;
  const contentType = input.contentType ?? "application/pdf";

  const result = await put(pathname, input.body, {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });

  return {
    url: result.url,
    pathname: result.pathname,
    contentType,
    size: computeBodySize(input.body),
  };
}

function computeBodySize(body: Buffer | ArrayBuffer | Blob): number {
  if (body instanceof Buffer) return body.length;
  if (body instanceof ArrayBuffer) return body.byteLength;
  return (body as Blob).size;
}
