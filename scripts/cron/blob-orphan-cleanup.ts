/**
 * Daily orphan-cleanup job for Vercel Blob receipts.
 *
 * Phase 20 MVP — wire to Vercel Cron in deployment WI (separate ops task).
 *
 * Policy (see docs/specs/2026-05-15-phase20-blob-lifecycle.md):
 *   1. IntakeDraft.status = DISCARDED   → delete immediately
 *   2. IntakeDraft.status = PENDING and createdAt > 30d ago → delete (stale)
 *   3. IntakeDraft.status = CONFIRMED   → kept for 5 years (RETENTION_POLICY)
 *
 * This script only handles cases 1+2. Confirmed-receipt retention beyond
 * 5 years requires Order-aware logic and is tracked separately.
 *
 * Errors on individual blobs are logged but do not abort the batch — one
 * 404 from a partially-deleted blob must not block the other 999.
 *
 * Usage:
 *   npx tsx scripts/cron/blob-orphan-cleanup.ts
 */

import { prisma } from "@axle/db";
import { deleteReceipt } from "../../apps/web/lib/erp/blob";

const STALE_PENDING_MS = 30 * 86400 * 1000;

async function main(): Promise<void> {
  const cutoff30d = new Date(Date.now() - STALE_PENDING_MS);

  const orphans = await prisma.intakeDraft.findMany({
    where: {
      OR: [
        { status: "DISCARDED" },
        { status: "PENDING", createdAt: { lt: cutoff30d } },
      ],
      blobUrl: { not: "" },
    },
    select: { id: true, blobUrl: true, status: true },
  });

  console.log(`[blob-orphan-cleanup] candidates=${orphans.length}`);

  let deleted = 0;
  let failed = 0;
  for (const d of orphans) {
    try {
      await deleteReceipt(d.blobUrl);
      // Null out the URL so we don't reattempt — keep the draft row for audit.
      await prisma.intakeDraft.update({
        where: { id: d.id },
        data: { blobUrl: "" },
      });
      deleted += 1;
    } catch (err) {
      failed += 1;
      console.error(`[blob-orphan-cleanup] draft=${d.id} status=${d.status}`, err);
    }
  }

  console.log(
    `[blob-orphan-cleanup] done deleted=${deleted} failed=${failed} total=${orphans.length}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[blob-orphan-cleanup] fatal:", err);
    process.exit(1);
  });
