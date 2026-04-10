"use client";

interface RevenueDataPoint {
  year: number;
  totalRevenue: number;
  clientCount: number;
}

interface RevenueChartProps {
  data: RevenueDataPoint[];
}

function krwShort(n: number): string {
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억`;
  if (n >= 1_0000) return `${(n / 1_0000).toFixed(0)}만`;
  return String(Math.round(n));
}

export function RevenueChart({ data }: RevenueChartProps) {
  const max = Math.max(...data.map((d) => d.totalRevenue), 1);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        재무 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((d) => {
        const pct = (d.totalRevenue / max) * 100;
        return (
          <div key={d.year} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{d.year}년</span>
              <span className="text-muted-foreground">
                {krwShort(d.totalRevenue)} ({d.clientCount}개사)
              </span>
            </div>
            <div className="h-5 w-full overflow-hidden rounded bg-muted">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
