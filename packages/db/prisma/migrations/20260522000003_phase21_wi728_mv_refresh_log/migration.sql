-- Phase 21 — ERP Amplification (WI-728-feat)
-- Audit log for materialized-view refreshes. Reports query the most
-- recent row to surface "데이터 기준 시각" so the UI can tell stale
-- numbers apart from live ones (design §5 WI-728 AC #3).
--
-- One row per cron invocation (~daily, plus any manual triggers). The
-- compound index supports the `findFirst({ orderBy: refreshedAt desc })`
-- the API performs per request.

-- CreateTable
CREATE TABLE "MvRefreshLog" (
    "id"          TEXT NOT NULL,
    "viewName"    TEXT NOT NULL,
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs"  INTEGER NOT NULL,
    "mode"        TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MvRefreshLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MvRefreshLog_viewName_refreshedAt_idx"
  ON "MvRefreshLog"("viewName", "refreshedAt");
