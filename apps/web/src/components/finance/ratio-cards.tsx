"use client";

import type { FinancialRatios } from "@/lib/services/financial-analysis";

interface RatioCardsProps {
  ratios: FinancialRatios;
}

function RatioCard({
  label,
  value,
  description,
  direction,
}: {
  label: string;
  value?: number;
  description?: string;
  direction?: "higher-better" | "lower-better";
}) {
  const fmt = value != null ? `${value.toFixed(2)}%` : "-";

  let colorClass = "text-foreground";
  if (value != null && direction) {
    if (direction === "higher-better") {
      colorClass = value >= 0 ? "text-green-600" : "text-red-500";
    } else {
      colorClass = value <= 100 ? "text-green-600" : "text-red-500";
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${colorClass}`}>{fmt}</p>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

export function RatioCards({ ratios }: RatioCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <RatioCard
        label="부채비율"
        value={ratios.debtRatio}
        description="부채/자본 × 100"
        direction="lower-better"
      />
      <RatioCard
        label="ROE"
        value={ratios.roe}
        description="순이익/자본 × 100"
        direction="higher-better"
      />
      <RatioCard
        label="ROA"
        value={ratios.roa}
        description="순이익/자산 × 100"
        direction="higher-better"
      />
      <RatioCard
        label="영업이익률"
        value={ratios.operatingMargin}
        description="영업이익/매출 × 100"
        direction="higher-better"
      />
      <RatioCard
        label="순이익률"
        value={ratios.netMargin}
        description="순이익/매출 × 100"
        direction="higher-better"
      />
      <RatioCard
        label="부채/자산 비율"
        value={ratios.debtToAsset}
        description="부채/자산 × 100"
        direction="lower-better"
      />
    </div>
  );
}
