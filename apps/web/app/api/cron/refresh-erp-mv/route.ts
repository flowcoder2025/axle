/**
 * /api/cron/refresh-erp-mv  (Phase 21 WI-728-prep)
 *
 * Daily refresh of the ERP reporting materialized view.
 *
 * Why CONCURRENTLY:
 *   `REFRESH MATERIALIZED VIEW CONCURRENTLY` does not block reads from
 *   the view, so the WI-728/729/730 report endpoints stay responsive
 *   during the refresh window. It requires a UNIQUE INDEX on the view
 *   (created in migration 20260522000002).
 *
 * Why the cron exists at all (vs Postgres pg_cron):
 *   Vercel Cron + Bearer-token auth is what the rest of the app uses
 *   (see vercel.json). Adding pg_cron would split the source of truth
 *   for "what scheduled jobs exist?" across two systems. The DB-side
 *   alternative remains available if cron lag becomes a problem.
 *
 * Failure handling:
 *   The refresh is idempotent — a later run picks up everything the
 *   failed one would have. We log + 500 to alert ops via Vercel's cron
 *   failure dashboard. No retry loop here; the next daily tick is the
 *   retry.
 *
 * Auth: Bearer + CRON_SECRET (Vercel env). Same pattern as the other
 * cron routes — see `lib/cron-auth.ts`.
 */

import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { verifyCronAuth } from "@/lib/cron-auth";

export const MV_NAME = "mv_erp_monthly_summary";

export async function POST(request: Request): Promise<Response> {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    // $executeRawUnsafe because identifier interpolation isn't possible
    // via $executeRaw template strings. MV_NAME is a hard-coded constant
    // (not user input) so there is no injection surface.
    await prisma.$executeRawUnsafe(
      `REFRESH MATERIALIZED VIEW CONCURRENTLY "${MV_NAME}"`,
    );
    const durationMs = Date.now() - startedAt;
    return NextResponse.json({
      ok: true,
      view: MV_NAME,
      durationMs,
      refreshedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Common cause on first run: the view is empty AND the index hasn't
    // been built. The migration ships WITH NO DATA + UNIQUE INDEX in the
    // same transaction so this should not trip in production, but a
    // pre-baseline tenant might. The non-CONCURRENTLY fallback is safe
    // (briefly blocks reads) and unblocks the cron for subsequent ticks.
    if (message.includes("has not been populated")) {
      try {
        await prisma.$executeRawUnsafe(
          `REFRESH MATERIALIZED VIEW "${MV_NAME}"`,
        );
        return NextResponse.json({
          ok: true,
          view: MV_NAME,
          durationMs: Date.now() - startedAt,
          refreshedAt: new Date().toISOString(),
          mode: "initial",
        });
      } catch (fallbackErr) {
        const fbMessage =
          fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        return NextResponse.json(
          { ok: false, view: MV_NAME, error: fbMessage },
          { status: 500 },
        );
      }
    }
    return NextResponse.json(
      { ok: false, view: MV_NAME, error: message },
      { status: 500 },
    );
  }
}
