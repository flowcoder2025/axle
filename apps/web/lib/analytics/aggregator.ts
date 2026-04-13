/**
 * Analytics aggregation queries — used by cron jobs and API routes.
 */
import { prisma } from "@axle/db";

// ── Types ────────────────────────────────────────────────────────────────────

export type OverviewStats = {
  pageViews: number;
  uniqueUsers: number;
  sessions: number;
  aiJobsTotal: number;
  aiJobsCost: number;
  apiCalls: number;
  apiErrors: number;
};

export type DailyTrend = {
  date: string;
  pageViews: number;
  uniqueUsers: number;
  sessions: number;
};

export type ActionCount = {
  action: string;
  count: number;
};

// ── Today (realtime from raw events) ─────────────────────────────────────────

const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export async function getTodayOverview(orgId?: string | null): Promise<OverviewStats> {
  const start = todayStart();
  const where = {
    createdAt: { gte: start },
    ...(orgId ? { orgId } : {}),
  };

  const [pageViews, uniqueUsers, sessions, aiJobs, apiCalls, apiErrors] = await Promise.all([
    prisma.analyticsEvent.count({ where: { ...where, category: "PAGE_VIEW" } }),
    prisma.analyticsEvent
      .groupBy({
        by: ["userId"],
        where: { ...where, userId: { not: null } },
      })
      .then((r) => r.length),
    prisma.analyticsEvent
      .groupBy({
        by: ["sessionId"],
        where,
      })
      .then((r) => r.length),
    prisma.analyticsEvent.aggregate({
      where: { ...where, category: "BUSINESS", action: { startsWith: "ai.job" } },
      _count: true,
      _sum: { value: true },
    }),
    prisma.analyticsEvent.count({ where: { ...where, category: "API_CALL" } }),
    prisma.analyticsEvent.count({
      where: { ...where, category: "SYSTEM", action: { contains: "error" } },
    }),
  ]);

  return {
    pageViews,
    uniqueUsers,
    sessions,
    aiJobsTotal: aiJobs._count,
    aiJobsCost: aiJobs._sum.value ?? 0,
    apiCalls,
    apiErrors,
  };
}

// ── Daily trends (from DailyMetric) ──────────────────────────────────────────

export async function getDailyTrends(
  days: number,
  orgId?: string | null,
): Promise<DailyTrend[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const metrics = await prisma.dailyMetric.findMany({
    where: {
      date: { gte: since },
      orgId: orgId ?? null,
    },
    orderBy: { date: "asc" },
    select: {
      date: true,
      pageViews: true,
      uniqueUsers: true,
      sessions: true,
    },
  });

  return metrics.map((m) => ({
    date: m.date.toISOString().split("T")[0]!,
    pageViews: m.pageViews,
    uniqueUsers: m.uniqueUsers,
    sessions: m.sessions,
  }));
}

// ── Feature usage (from DailyActionMetric) ───────────────────────────────────

export async function getTopActions(
  days: number,
  limit: number = 20,
  orgId?: string | null,
): Promise<ActionCount[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const results = await prisma.dailyActionMetric.groupBy({
    by: ["action"],
    where: {
      date: { gte: since },
      orgId: orgId ?? null,
    },
    _sum: { count: true },
    orderBy: { _sum: { count: "desc" } },
    take: limit,
  });

  return results.map((r) => ({
    action: r.action,
    count: r._sum.count ?? 0,
  }));
}

// ── Upsert helpers (handle nullable orgId correctly) ─────────────────────────
//
// Prisma's compound unique upsert (`date_orgId`) requires orgId: string (non-null).
// When orgId is null (platform-wide rows), NULL != NULL in SQL so the unique
// constraint won't match. We use findFirst + create/update instead.

async function upsertDailyMetric(
  dateOnly: Date,
  orgId: string | null,
  data: {
    pageViews: number;
    uniqueUsers: number;
    sessions: number;
    projectsCreated: number;
    documentsProcessed: number;
    matchingsRun: number;
    aiJobsTotal: number;
    aiJobsCost: number;
    apiCalls: number;
    apiErrors: number;
    automationRuns: number;
    automationFailures: number;
  },
): Promise<void> {
  if (orgId !== null) {
    // Non-null orgId: use compound unique upsert
    await prisma.dailyMetric.upsert({
      where: { date_orgId: { date: dateOnly, orgId } },
      create: {
        date: dateOnly,
        orgId,
        avgSessionSec: 0,
        aiAvgDurationMs: 0,
        avgResponseMs: 0,
        ...data,
      },
      update: data,
    });
  } else {
    // Null orgId (platform-wide): findFirst + create/update
    const existing = await prisma.dailyMetric.findFirst({
      where: { date: dateOnly, orgId: null },
      select: { id: true },
    });
    if (existing) {
      await prisma.dailyMetric.update({ where: { id: existing.id }, data });
    } else {
      await prisma.dailyMetric.create({
        data: {
          date: dateOnly,
          orgId: null,
          avgSessionSec: 0,
          aiAvgDurationMs: 0,
          avgResponseMs: 0,
          ...data,
        },
      });
    }
  }
}

async function upsertDailyActionMetric(
  dateOnly: Date,
  orgId: string | null,
  action: string,
  count: number,
): Promise<void> {
  if (orgId !== null) {
    // Non-null orgId: use compound unique upsert
    await prisma.dailyActionMetric.upsert({
      where: { date_orgId_action: { date: dateOnly, orgId, action } },
      create: { date: dateOnly, orgId, action, count },
      update: { count },
    });
  } else {
    // Null orgId (platform-wide): findFirst + create/update
    const existing = await prisma.dailyActionMetric.findFirst({
      where: { date: dateOnly, orgId: null, action },
      select: { id: true },
    });
    if (existing) {
      await prisma.dailyActionMetric.update({ where: { id: existing.id }, data: { count } });
    } else {
      await prisma.dailyActionMetric.create({
        data: { date: dateOnly, orgId: null, action, count },
      });
    }
  }
}

// ── Aggregation job (called by cron) ─────────────────────────────────────────

export async function aggregateYesterday(): Promise<{ orgs: number; actions: number }> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const todayMidnight = new Date(yesterday);
  todayMidnight.setDate(todayMidnight.getDate() + 1);

  const dateOnly = new Date(yesterday.toISOString().split("T")[0]!);

  const baseWhere = {
    createdAt: { gte: yesterday, lt: todayMidnight },
  };

  // Get all orgIds that had events yesterday + null for platform total
  const orgGroups = await prisma.analyticsEvent.groupBy({
    by: ["orgId"],
    where: baseWhere,
  });
  const orgIds = [...new Set([null, ...orgGroups.map((g) => g.orgId)])];

  let actionCount = 0;

  for (const orgId of orgIds) {
    const where = { ...baseWhere, ...(orgId ? { orgId } : {}) };

    const [
      pageViews,
      uniqueUsersResult,
      sessionsResult,
      aiAgg,
      apiCalls,
      apiErrors,
      projectsCreated,
      documentsProcessed,
      matchingsRun,
      automationRuns,
      automationFailures,
    ] = await Promise.all([
      prisma.analyticsEvent.count({ where: { ...where, category: "PAGE_VIEW" } }),
      prisma.analyticsEvent.groupBy({ by: ["userId"], where: { ...where, userId: { not: null } } }),
      prisma.analyticsEvent.groupBy({ by: ["sessionId"], where }),
      prisma.analyticsEvent.aggregate({
        where: { ...where, category: "BUSINESS", action: { startsWith: "ai.job" } },
        _count: true,
        _sum: { value: true },
        _avg: { value: true },
      }),
      prisma.analyticsEvent.count({ where: { ...where, category: "API_CALL" } }),
      prisma.analyticsEvent.count({
        where: { ...where, category: "SYSTEM", action: { contains: "error" } },
      }),
      prisma.analyticsEvent.count({ where: { ...where, action: "project.create" } }),
      prisma.analyticsEvent.count({ where: { ...where, action: "doc.upload" } }),
      prisma.analyticsEvent.count({ where: { ...where, action: "matching.run" } }),
      prisma.analyticsEvent.count({ where: { ...where, action: "automation.run" } }),
      prisma.analyticsEvent.count({ where: { ...where, action: "automation.fail" } }),
    ]);

    await upsertDailyMetric(dateOnly, orgId, {
      pageViews,
      uniqueUsers: uniqueUsersResult.length,
      sessions: sessionsResult.length,
      projectsCreated,
      documentsProcessed,
      matchingsRun,
      aiJobsTotal: aiAgg._count,
      aiJobsCost: aiAgg._sum.value ?? 0,
      apiCalls,
      apiErrors,
      automationRuns,
      automationFailures,
    });

    // Aggregate action counts
    const actionGroups = await prisma.analyticsEvent.groupBy({
      by: ["action"],
      where,
      _count: true,
    });

    for (const ag of actionGroups) {
      await upsertDailyActionMetric(dateOnly, orgId, ag.action, ag._count);
      actionCount++;
    }
  }

  return { orgs: orgIds.length, actions: actionCount };
}

// ── Cleanup (called by cron) ─────────────────────────────────────────────────

export async function cleanupOldEvents(retentionDays: number = 90): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  let totalDeleted = 0;
  const BATCH_SIZE = 10_000;

  // Batch delete to avoid table lock
  while (true) {
    const batch = await prisma.analyticsEvent.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;

    const deleted = await prisma.analyticsEvent.deleteMany({
      where: { id: { in: batch.map((b) => b.id) } },
    });

    totalDeleted += deleted.count;

    if (batch.length < BATCH_SIZE) break;
  }

  return totalDeleted;
}
