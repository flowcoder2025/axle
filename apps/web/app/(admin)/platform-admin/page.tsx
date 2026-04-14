import { prisma } from "@axle/db";
import { getTodayOverview, getDailyTrends, getTopActions, getActiveUsers } from "@/lib/analytics/aggregator";
import { StatCard } from "@/src/components/admin/stat-card";
import { TrendChart } from "@/src/components/admin/trend-chart";
import { FeatureRankChart } from "@/src/components/admin/feature-rank-chart";
import { ActivityFeed } from "@/src/components/admin/activity-feed";
import { OrgLeaderboard } from "@/src/components/admin/org-leaderboard";

export default async function AdminDashboardPage() {
  const [today, trends, topActions, wau, mau, platformStats, recentEvents, orgLeaderboard] =
    await Promise.all([
      getTodayOverview(),
      getDailyTrends(30),
      getTopActions(30, 10),
      getActiveUsers(7),
      getActiveUsers(30),
      prisma.$queryRawUnsafe<{ totalOrgs: bigint; totalUsers: bigint; newThisWeek: bigint }[]>(
        `SELECT
          (SELECT COUNT(*) FROM "Organization") as "totalOrgs",
          (SELECT COUNT(*) FROM "User") as "totalUsers",
          (SELECT COUNT(*) FROM "User" WHERE "createdAt" > NOW() - INTERVAL '7 days') as "newThisWeek"`
      ).then((r) => ({
        totalOrgs: Number(r[0]?.totalOrgs ?? 0),
        totalUsers: Number(r[0]?.totalUsers ?? 0),
        newThisWeek: Number(r[0]?.newThisWeek ?? 0),
      })),
      prisma.analyticsEvent.findMany({
        where: { category: { in: ["BUSINESS", "FEATURE_USE"] } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          action: true,
          userId: true,
          category: true,
          createdAt: true,
        },
      }),
      prisma.dailyMetric.groupBy({
        by: ["orgId"],
        where: {
          orgId: { not: null },
          date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        _sum: { pageViews: true },
        orderBy: { _sum: { pageViews: "desc" } },
        take: 10,
      }),
    ]);

  // Enrich recent events with user names
  const userIds = [...new Set(recentEvents.map((e) => e.userId).filter(Boolean))] as string[];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const activityEvents = recentEvents.map((e) => ({
    id: e.id,
    action: e.action,
    userId: e.userId,
    userName: e.userId ? (userMap.get(e.userId) ?? null) : null,
    category: e.category,
    createdAt: e.createdAt.toISOString(),
  }));

  // Enrich org leaderboard with names
  const orgIds = orgLeaderboard.map((o) => o.orgId).filter(Boolean) as string[];
  const orgs = await prisma.organization.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, name: true },
  });
  const orgMap = new Map(orgs.map((o) => [o.id, o.name]));

  const orgRanks = orgLeaderboard.map((o) => ({
    orgId: o.orgId ?? "",
    orgName: orgMap.get(o.orgId ?? "") ?? "Unknown",
    eventCount: o._sum.pageViews ?? 0,
  }));

  // DAU change vs yesterday
  const yesterdayUsers = trends.length >= 2 ? trends[trends.length - 1]!.uniqueUsers : 0;
  const dauChange = yesterdayUsers > 0
    ? ((today.uniqueUsers - yesterdayUsers) / yesterdayUsers) * 100
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">플랫폼 대시보드</h1>
        <p className="text-sm text-muted-foreground">AXLE 플랫폼 전체 통계</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="DAU / WAU / MAU"
          value={`${today.uniqueUsers} / ${wau} / ${mau}`}
          change={dauChange}
          description="활성 사용자"
        />
        <StatCard
          title="페이지뷰 / 세션"
          value={`${today.pageViews.toLocaleString()} / ${today.sessions.toLocaleString()}`}
          description="오늘"
        />
        <StatCard
          title="AI 작업 / 비용"
          value={`${today.aiJobsTotal} / $${today.aiJobsCost.toFixed(2)}`}
          description="오늘"
        />
        <StatCard
          title="조직 / 사용자"
          value={`${platformStats.totalOrgs} / ${platformStats.totalUsers}`}
          description={`이번 주 신규 ${platformStats.newThisWeek}명`}
        />
        <StatCard
          title="API 에러율"
          value={
            today.apiCalls > 0
              ? `${((today.apiErrors / today.apiCalls) * 100).toFixed(1)}%`
              : "0%"
          }
          description={`${today.apiErrors} / ${today.apiCalls} 호출`}
        />
        <StatCard
          title="비즈니스 활동"
          value={String(today.aiJobsTotal + today.apiCalls)}
          description="AI + API 합산"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TrendChart data={trends} title="30일 트렌드" />
        <FeatureRankChart data={topActions} title="기능 사용 랭킹 (30일)" />
        <ActivityFeed events={activityEvents} />
        <OrgLeaderboard data={orgRanks} />
      </div>
    </div>
  );
}
