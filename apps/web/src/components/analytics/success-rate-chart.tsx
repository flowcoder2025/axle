"use client";

interface ProjectStatusCount {
  status: string;
  count: number;
}

interface SuccessRateChartProps {
  data: ProjectStatusCount[];
  total: number;
}

const STATUS_LABELS: Record<string, string> = {
  APPROVED: "승인",
  COMPLETED: "완료",
  SUBMITTED: "제출",
  IN_PROGRESS: "진행중",
  REJECTED: "반려",
  INTAKE: "접수",
  DOC_COLLECTING: "서류수집",
  REVIEW: "검토",
};

const STATUS_COLORS: Record<string, string> = {
  APPROVED: "bg-green-500",
  COMPLETED: "bg-blue-500",
  SUBMITTED: "bg-indigo-400",
  IN_PROGRESS: "bg-yellow-400",
  REJECTED: "bg-red-400",
  INTAKE: "bg-gray-300",
  DOC_COLLECTING: "bg-orange-300",
  REVIEW: "bg-purple-400",
};

export function SuccessRateChart({ data, total }: SuccessRateChartProps) {
  const successCount = data
    .filter((d) => d.status === "APPROVED" || d.status === "COMPLETED")
    .reduce((sum, d) => sum + d.count, 0);
  const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-bold">{successRate}%</span>
        <span className="text-sm text-muted-foreground mb-1">성공률 ({successCount}/{total}건)</span>
      </div>

      {/* Stacked bar */}
      {total > 0 && (
        <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
          {data.map((d) => {
            const pct = (d.count / total) * 100;
            const color = STATUS_COLORS[d.status] ?? "bg-gray-400";
            return (
              <div
                key={d.status}
                className={`${color} transition-all`}
                style={{ width: `${pct}%` }}
                title={`${STATUS_LABELS[d.status] ?? d.status}: ${d.count}건 (${pct.toFixed(1)}%)`}
              />
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {data.map((d) => {
          const color = STATUS_COLORS[d.status] ?? "bg-gray-400";
          return (
            <div key={d.status} className="flex items-center gap-1.5">
              <div className={`h-2.5 w-2.5 rounded-sm ${color}`} />
              <span>
                {STATUS_LABELS[d.status] ?? d.status} {d.count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
