/**
 * Vercel Blob helpers for receipt intake.
 *
 * Phase 20 MVP: uploads are written as `public` blobs at unguessable URLs
 * under `erp/receipts/<orgId>/<draftId>-<ts>.<ext>`. The URLs are stored in
 * `IntakeDraft.blobUrl` and never indexed; signed URLs land in Phase 21+.
 *
 * Retention/cleanup is handled by a separate cron (WI-714); this module only
 * exposes the primitive operations.
 */

import { put, del, list } from "@vercel/blob";

const PREFIX = "erp/receipts";

function extFromContentType(contentType: string): string {
  const tail = contentType.split("/")[1];
  if (!tail) return "bin";
  // strip charset/parameters like "jpeg;something"
  return tail.split(";")[0]?.trim() || "bin";
}

/**
 * Upload a receipt image for a given draft. Returns the resulting blob URL.
 *
 * Path: `erp/receipts/<orgId>/<draftId>-<unixMs>.<ext>`. The timestamp
 * suffix prevents accidental cache collisions when a draft is rewritten.
 */
export async function uploadReceipt(
  orgId: string,
  draftId: string,
  buf: Buffer,
  contentType: string,
): Promise<string> {
  const ext = extFromContentType(contentType);
  const path = `${PREFIX}/${orgId}/${draftId}-${Date.now()}.${ext}`;
  const result = await put(path, buf, { access: "public", contentType });
  return result.url;
}

/** Delete a previously uploaded receipt blob. Used by the orphan cleanup cron. */
export async function deleteReceipt(url: string): Promise<void> {
  await del(url);
}

/**
 * List blobs uploaded before `beforeIso` under the receipts prefix.
 *
 * Used by the orphan cleanup cron: the caller cross-checks each URL against
 * `IntakeDraft` rows (status DISCARDED + age > retention) and deletes
 * unreferenced blobs. Listing is bounded to 1000 entries per call — the cron
 * is expected to page when needed.
 */
export async function listOrphanReceipts(beforeIso: string): Promise<string[]> {
  const cutoff = new Date(beforeIso);
  const all = await list({ prefix: PREFIX, limit: 1000 });
  return all.blobs
    .filter((b) => b.uploadedAt < cutoff)
    .map((b) => b.url);
}
