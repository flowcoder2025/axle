import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui";
import { SuccessRateChart } from "../../../src/components/analytics/success-rate-chart";
import { RevenueChart } from "../../../src/components/analytics/revenue-chart";
import { ConsultantPerformance } from "../../../src/components/analytics/consultant-performance";
import { PortfolioOverview } from "../../../src/components/analytics/portfolio-overview";

export const metadata = { title: "Analytics | AXLE" };

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user?.orgId) notFound();

  const orgId = user.orgId;

  // ── 1. Project status distribution ────────────────────────────────────────
  const projectStatusGroups = await prisma.project.groupBy({
    by: ["status"],
    where: { client: { orgId } },
    _count: { status: true },
  });

  const statusData = projectStatusGroups.map((g) => ({
    status: g.status,
    count: g._count.status,
  }));
  const totalProjects = statusData.reduce((s, d) => s + d.count, 0);

  // ── 2. Revenue by year (last 5 years) ─────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 4 + i);

  const financials = await prisma.clientFinancial.findMany({
    where: {
      client: { orgId },
      year: { in: years },
      revenue: { not: null },
    },
    select: { year: true, revenue: true },
  });

  const revenueByYear = years.map((yr) => {
    const group = financials.filter((f) => f.year === yr);
    const totalRevenue = group.reduce(
      (s, f) => s + (f.revenue ? Number(f.revenue) : 0),
      0
    );
    return { year: yr, totalRevenue, clientCount: group.length };
  });

  // ── 3. Consultant performance ──────────────────────────────────────────────
  const consultantGroups = await prisma.project.groupBy({
    by: ["assignedToId", "status"],
    where: { client: { orgId }, assignedToId: { not: null } },
    _count: { status: true },
  });

  const consultantMap: Record<string, { projectCount: number; completedCount: number }> = {};
  for (const g of consultantGroups) {
    if (!g.assignedToId) continue;
    if (!consultantMap[g.assignedToId]) {
      consultantMap[g.assignedToId] = { projectCount: 0, completedCount: 0 };
    }
    consultantMap[g.assignedToId].projectCount += g._count.status;
    if (g.status === "COMPLETED" || g.status === "APPROVED") {
      consultantMap[g.assignedToId].completedCount += g._count.status;
    }
  }

  // Resolve user names for display
  const consultantIds = Object.keys(consultantMap);
  const consultantUsers = consultantIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: consultantIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userNameMap = new Map(
    consultantUsers.map((u) => [u.id, u.name ?? u.email])
  );

  const consultantData = Object.entries(consultantMap)
    .map(([id, stats]) => ({
      assignedTo: userNameMap.get(id) ?? id,
      ...stats,
    }))
    .sort((a, b) => b.projectCount - a.projectCount)
    .slice(0, 10);

  // ── 4. Portfolio overview ──────────────────────────────────────────────────
  const [clientCount, activeClientCount, projectCount, achievementCount, revenueAgg] =
    await Promise.all([
      prisma.client.count({ where: { orgId } }),
      prisma.client.count({ where: { orgId, status: "ACTIVE" } }),
      prisma.project.count({ where: { client: { orgId } } }),
      prisma.clientAchievement.count({ where: { client: { orgId } } }),
      prisma.clientFinancial.aggregate({
        where: { client: { orgId }, revenue: { not: null } },
        _sum: { revenue: true },
      }),
    ]);

  const totalRevenueSum = Number(revenueAgg._sum.revenue ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">조직 전체 KPI 현황</p>
      </div>

      {/* Portfolio overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">포트폴리오 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <PortfolioOverview
            clientCount={clientCount}
            activeClientCount={activeClientCount}
            projectCount={projectCount}
            achievementCount={achievementCount}
            totalRevenueSum={totalRevenueSum}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Project success rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">프로젝트 성공률</CardTitle>
          </CardHeader>
          <CardContent>
            <SuccessRateChart data={statusData} total={totalProjects} />
          </CardContent>
        </Card>

        {/* Revenue chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">연도별 고객사 매출 합산</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenueByYear.filter((d) => d.clientCount > 0)} />
          </CardContent>
        </Card>
      </div>

      {/* Consultant performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">컨설턴트별 프로젝트 현황 (Top 10)</CardTitle>
        </CardHeader>
        <CardContent>
          <ConsultantPerformance data={consultantData} />
        </CardContent>
      </Card>
    </div>
  );
}
