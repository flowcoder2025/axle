import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "@axle/ui";

type StatCardProps = {
  title: string;
  value: string | number;
  description?: string;
  change?: number;
};

export function StatCard({ title, value, description, change }: StatCardProps) {
  return (
    <Card className="border bg-card">
      <CardHeader className="pb-2">
        <CardDescription className="text-xs font-medium uppercase tracking-wider">
          {title}
        </CardDescription>
        <CardTitle className="text-3xl font-bold">
          {typeof value === "number" ? value.toLocaleString() : value}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          {change !== undefined && (
            <span
              className={`text-xs font-medium ${change >= 0 ? "text-emerald-600" : "text-red-600"}`}
            >
              {change >= 0 ? "+" : ""}
              {change.toFixed(1)}%
            </span>
          )}
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
