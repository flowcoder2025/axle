/**
 * StockSummary — Server Component.
 *
 * Renders four totals as cards: balance (in − out), in, out, and the raw
 * ADJUST sum. All values are integers because qty is `Int` in the schema.
 */

interface StockSummaryProps {
  balance: number;
  inSum: number;
  outSum: number;
  adjustSum: number;
  unit: string;
}

const numberFormatter = new Intl.NumberFormat("ko-KR");

export function StockSummary({ balance, inSum, outSum, adjustSum, unit }: StockSummaryProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card label="현재 재고" value={balance} unit={unit} accent="primary" />
      <Card label="입고 합계" value={inSum} unit={unit} accent="positive" />
      <Card label="출고 합계" value={outSum} unit={unit} accent="negative" />
      <Card label="조정 합계" value={adjustSum} unit={unit} accent="neutral" />
    </div>
  );
}

interface CardProps {
  label: string;
  value: number;
  unit: string;
  accent: "primary" | "positive" | "negative" | "neutral";
}

const accentClass: Record<CardProps["accent"], string> = {
  primary: "text-foreground",
  positive: "text-emerald-700",
  negative: "text-rose-700",
  neutral: "text-muted-foreground",
};

function Card({ label, value, unit, accent }: CardProps) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${accentClass[accent]}`}>
        {numberFormatter.format(value)}
        <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}
