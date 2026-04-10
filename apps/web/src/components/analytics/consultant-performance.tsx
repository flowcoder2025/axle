"use client";

interface ConsultantStat {
  assignedTo: string;
  projectCount: number;
  completedCount: number;
}

interface ConsultantPerformanceProps {
  data: ConsultantStat[];
}

export function ConsultantPerformance({ data }: ConsultantPerformanceProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        데이터가 없습니다.
      </div>
    );
  }

  const maxProjects = Math.max(...data.map((d) => d.projectCount), 1);

  return (
    <div className="space-y-3">
      {data.map((stat) => {
        const pct = (stat.projectCount / maxProjects) * 100;
        const successRate =
          stat.projectCount > 0
            ? Math.round((stat.completedCount / stat.projectCount) * 100)
            : 0;

        return (
          <div key={stat.assignedTo} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium truncate max-w-[140px]">{stat.assignedTo}</span>
              <span className="text-muted-foreground ml-2 shrink-0">
                {stat.projectCount}건 / 성공률 {successRate}%
              </span>
            </div>
            <div className="relative h-5 w-full overflow-hidden rounded bg-muted">
              <div className="h-full bg-indigo-400 transition-all" style={{ width: `${pct}%` }} />
              {stat.projectCount > 0 && (
                <div
                  className="absolute inset-y-0 left-0 bg-indigo-600"
                  style={{ width: `${(stat.completedCount / maxProjects) * 100}%` }}
                />
              )}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">진한 색: 완료, 연한 색: 전체</p>
    </div>
  );
}
