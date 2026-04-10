import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui";
import { ArrowLeft } from "lucide-react";
import { RatioCards } from "../../../../src/components/finance/ratio-cards";
import { ReportSection } from "../../../../src/components/finance/report-section";
import { calculateFinancialRatios } from "@/lib/services/financial-analysis";

interface PageProps {
  params: Promise<{ clientId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { clientId } = await params;
  const client = await prisma.client.findFirst({
    where: { id: clientId },
    select: { name: true },
  });
  return { title: client ? `${client.name} 재무 | AXLE` : "재무 상세 | AXLE" };
}

function krw(n: number | null | undefined): string {
  if (n == null) return "-";
  return new Intl.NumberFormat("ko-KR").format(Math.round(n)) + "원";
}

export default async function FinanceDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user?.orgId) notFound();

  const { clientId } = await params;

  const client = await prisma.client.findFirst({
    where: { id: clientId, orgId: user.orgId },
    select: { id: true, name: true, industry: true },
  });
  if (!client) notFound();

  const financials = await prisma.clientFinancial.findMany({
    where: { clientId },
    orderBy: { year: "desc" },
  });

  const reports = await prisma.financialReport.findMany({
    where: { clientId },
    orderBy: { year: "desc" },
    select: { id: true, year: true, reportUrl: true, createdAt: true },
  });

  // Latest year ratios
  const latestFinancial = financials[0];
  const latestRatios = latestFinancial
    ? calculateFinancialRatios({
        revenue: latestFinancial.revenue ? Number(latestFinancial.revenue) : null,
        operatingProfit: latestFinancial.operatingProfit
          ? Number(latestFinancial.operatingProfit)
          : null,
        netProfit: latestFinancial.netProfit ? Number(latestFinancial.netProfit) : null,
        totalAssets: latestFinancial.totalAssets ? Number(latestFinancial.totalAssets) : null,
        totalLiabilities: latestFinancial.totalLiabilities
          ? Number(latestFinancial.totalLiabilities)
          : null,
        totalEquity: latestFinancial.totalEquity ? Number(latestFinancial.totalEquity) : null,
      })
    : null;

  const availableYears = financials.map((f) => f.year);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/finance"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          재무 현황
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{client.name}</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
        {client.industry && (
          <p className="text-muted-foreground mt-1">{client.industry}</p>
        )}
      </div>

      {/* Latest ratios */}
      {latestRatios && latestFinancial && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {latestFinancial.year}년 재무 비율
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RatioCards ratios={latestRatios} />
          </CardContent>
        </Card>
      )}

      {/* Yearly financial data table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">연도별 재무 현황</CardTitle>
        </CardHeader>
        <CardContent>
          {financials.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              등록된 재무 데이터가 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left font-medium">연도</th>
                    <th className="py-2 text-right font-medium">매출액</th>
                    <th className="py-2 text-right font-medium">영업이익</th>
                    <th className="py-2 text-right font-medium">당기순이익</th>
                    <th className="py-2 text-right font-medium">자산총계</th>
                    <th className="py-2 text-right font-medium">부채총계</th>
                    <th className="py-2 text-right font-medium">자본총계</th>
                    <th className="py-2 text-center font-medium">신용등급</th>
                    <th className="py-2 text-center font-medium">출처</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {financials.map((f) => (
                    <tr key={f.id} className="hover:bg-muted/30">
                      <td className="py-2.5 font-medium">{f.year}년</td>
                      <td className="py-2.5 text-right">{krw(f.revenue ? Number(f.revenue) : null)}</td>
                      <td className="py-2.5 text-right">{krw(f.operatingProfit ? Number(f.operatingProfit) : null)}</td>
                      <td className="py-2.5 text-right">{krw(f.netProfit ? Number(f.netProfit) : null)}</td>
                      <td className="py-2.5 text-right">{krw(f.totalAssets ? Number(f.totalAssets) : null)}</td>
                      <td className="py-2.5 text-right">{krw(f.totalLiabilities ? Number(f.totalLiabilities) : null)}</td>
                      <td className="py-2.5 text-right">{krw(f.totalEquity ? Number(f.totalEquity) : null)}</td>
                      <td className="py-2.5 text-center">{f.creditRating ?? "-"}</td>
                      <td className="py-2.5 text-center text-xs text-muted-foreground">
                        {f.source ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report generation section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">재무분석 보고서</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportSection
            clientId={clientId}
            reports={reports.map((r) => ({
              ...r,
              createdAt: r.createdAt.toISOString(),
            }))}
            availableYears={availableYears}
          />
        </CardContent>
      </Card>
    </div>
  );
}
