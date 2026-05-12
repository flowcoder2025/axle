import { getCurrentUser, checkModulePermissionLegacy } from "@axle/auth";
import { prisma } from "@axle/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export const metadata = { title: "재무 | AXLE" };

function krwShort(n: number): string {
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억`;
  if (n >= 1_0000) return `${(n / 1_0000).toFixed(0)}만`;
  return String(Math.round(n));
}

function GrowthIcon({ growth }: { growth?: number }) {
  if (growth == null) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  if (growth > 0) return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
  if (growth < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export default async function FinancePage() {
  const user = await getCurrentUser();
  if (!user?.orgId) notFound();

  // WI-619 — module ReBAC gate. Backward-compatible: orgs without any
  // module-scope grants pass through (legacy), but once grants exist the
  // user needs `finance:read` (or higher) to view this page.
  const allowed = await checkModulePermissionLegacy(
    user.id,
    user.orgId,
    "finance:read",
  );
  if (!allowed) notFound();

  const currentYear = new Date().getFullYear();

  // Clients with their most recent two years of financials
  const clients = await prisma.client.findMany({
    where: { orgId: user.orgId, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      industry: true,
      financials: {
        where: { year: { in: [currentYear - 1, currentYear - 2] } },
        orderBy: { year: "desc" },
        select: { year: true, revenue: true, netProfit: true, creditRating: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">재무 현황</h1>
        <p className="text-muted-foreground mt-1">고객사별 재무 현황 요약</p>
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            활성 고객사가 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">고객사</th>
                <th className="px-4 py-3 text-left font-medium">업종</th>
                <th className="px-4 py-3 text-right font-medium">
                  {currentYear - 1}년 매출
                </th>
                <th className="px-4 py-3 text-right font-medium">YoY</th>
                <th className="px-4 py-3 text-right font-medium">순이익</th>
                <th className="px-4 py-3 text-center font-medium">신용등급</th>
                <th className="px-4 py-3 text-center font-medium">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {clients.map((client) => {
                const latest = client.financials.find((f) => f.year === currentYear - 1);
                const prev = client.financials.find((f) => f.year === currentYear - 2);

                const revenue = latest?.revenue ? Number(latest.revenue) : null;
                const prevRevenue = prev?.revenue ? Number(prev.revenue) : null;
                const netProfit = latest?.netProfit ? Number(latest.netProfit) : null;

                let growth: number | undefined;
                if (revenue != null && prevRevenue != null && prevRevenue !== 0) {
                  growth = Math.round(((revenue - prevRevenue) / prevRevenue) * 100);
                }

                return (
                  <tr key={client.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{client.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {client.industry ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {revenue != null ? krwShort(revenue) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <GrowthIcon growth={growth} />
                        <span
                          className={
                            growth == null
                              ? "text-muted-foreground"
                              : growth > 0
                              ? "text-green-600"
                              : growth < 0
                              ? "text-red-500"
                              : ""
                          }
                        >
                          {growth != null ? `${growth > 0 ? "+" : ""}${growth}%` : "-"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {netProfit != null ? krwShort(netProfit) : "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {latest?.creditRating ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/finance/${client.id}`}
                        className="text-primary hover:underline text-xs"
                      >
                        보기
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
