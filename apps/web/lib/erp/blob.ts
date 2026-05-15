/**
 * Vercel Blob helpers for receipt intake.
 *
 * Phase 20 MVP: uploads are written as `public` blobs at unguessable URLs
 * under `erp/receipts/<orgId>/<draftId>-<ts>-<random>.<ext>`. The URLs are
 * stored in `IntakeDraft.blobUrl` and never indexed. Signed/private URLs land
 * in Phase 21+ when Vercel Blob exposes a private scope outside Enterprise.
 *
 * Retention is 5 years per Korean tax law (소득세법/부가가치세법) for
 * confirmed receipts. Orphan drafts (DISCARDED or stale PENDING) are pruned
 * daily by `scripts/cron/blob-orphan-cleanup.ts` — this module only exposes
 * the primitives (upload / delete / list-older-than).
 */

import { put, del, list } from "@vercel/blob";

const PREFIX = "erp/receipts";

/**
 * Retention window for confirmed receipts. Driven by Korean tax statute:
 * 부가가치세법 §32, 소득세법 §160 require 5-year record retention.
 */
const RETENTION_DAYS = 5 * 365;

/**
 * Public retention policy descriptor. Surfaced in the lifecycle doc and
 * referenced from the orphan-cleanup cron to keep the policy in one place.
 */
export const RETENTION_POLICY = {
  days: RETENTION_DAYS,
  reason: "한국 세무 보관 의무 (소득세법 §160 / 부가가치세법 §32)",
} as const;

function extFromContentType(contentType: string): string {
  const tail = contentType.split("/")[1];
  if (!tail) return "bin";
  // strip charset/parameters like "jpeg;something"
  return tail.split(";")[0]?.trim() || "bin";
}

/**
 * Upload a receipt image for a given draft. Returns the resulting blob URL.
 *
 * Path: `erp/receipts/<orgId>/<draftId>-<unixMs>-<random>.<ext>`.
 *   - `draftId` lets the cleanup cron correlate blobs back to drafts.
 *   - `Date.now()` keeps URLs distinct when a draft is rewritten.
 *   - `addRandomSuffix: true` adds Vercel's random token so the public URL is
 *     practically unguessable until private/signed scope ships in Phase 21+.
 *
 * Signature is intentionally stable — callers (WI-711 intake route) pass
 * `(orgId, draftId, buf, contentType)` and depend on this shape.
 */
export async function uploadReceipt(
  orgId: string,
  draftId: string,
  buf: Buffer,
  contentType: string,
): Promise<string> {
  const ext = extFromContentType(contentType);
  const path = `${PREFIX}/${orgId}/${draftId}-${Date.now()}.${ext}`;
  const result = await put(path, buf, {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });
  return result.url;
}

/** Delete a previously uploaded receipt blob. Used by the orphan cleanup cron. */
export async function deleteReceipt(url: string): Promise<void> {
  await del(url);
}

/**
 * List blobs uploaded before `beforeIso` under the receipts prefix.
 *
 * Legacy single-page helper retained for compatibility. New callers should
 * prefer {@link findOrphans} which pages through the full listing.
 */
export async function listOrphanReceipts(beforeIso: string): Promise<string[]> {
  const cutoff = new Date(beforeIso);
  const all = await list({ prefix: PREFIX, limit: 1000 });
  return all.blobs
    .filter((b) => b.uploadedAt < cutoff)
    .map((b) => b.url);
}

/**
 * Page through every blob under the receipts prefix and return those
 * uploaded before `beforeIso`.
 *
 * The cron uses this to find candidate orphan URLs, then cross-checks each
 * against `IntakeDraft` rows (status DISCARDED, or PENDING + stale) before
 * deleting — listing alone does NOT authorize deletion.
 */
export async function findOrphans(
  beforeIso: Date,
): Promise<{ url: string; uploadedAt: Date }[]> {
  let cursor: string | undefined;
  const out: { url: string; uploadedAt: Date }[] = [];
  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
    for (const b of page.blobs) {
      if (b.uploadedAt < beforeIso) {
        out.push({ url: b.url, uploadedAt: b.uploadedAt });
      }
    }
    cursor = page.cursor;
  } while (cursor);
  return out;
}
