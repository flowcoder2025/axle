"use client";

interface PortfolioOverviewProps {
  clientCount: number;
  activeClientCount: number;
  projectCount: number;
  achievementCount: number;
  totalRevenueSum: number;
}

function krwShort(n: number): string {
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억원`;
  if (n >= 1_0000) return `${(n / 1_0000).toFixed(0)}만원`;
  return `${Math.round(n)}원`;
}

export function PortfolioOverview({
  clientCount,
  activeClientCount,
  projectCount,
  achievementCount,
  totalRevenueSum,
}: PortfolioOverviewProps) {
  const stats = [
    { label: "전체 고객사", value: `${clientCount}개`, sub: `활성 ${activeClientCount}개` },
    { label: "전체 프로젝트", value: `${projectCount}건` },
    { label: "성과 등록", value: `${achievementCount}건` },
    { label: "집계 매출 합산", value: krwShort(totalRevenueSum) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg border p-4 space-y-1">
          <p className="text-xs text-muted-foreground">{s.label}</p>
          <p className="text-2xl font-bold">{s.value}</p>
          {s.sub && <p className="text-xs text-muted-foreground">{s.sub}</p>}
        </div>
      ))}
    </div>
  );
}
