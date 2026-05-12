import { Badge } from "@axle/ui";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "활성",
  PAUSED: "일시정지",
  TERMINATED: "종료",
};

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ACTIVE: "default",
  PAUSED: "secondary",
  TERMINATED: "destructive",
};

export function ManagedOrgStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={STATUS_VARIANT[status] ?? "outline"}
      data-testid={`managed-org-status-${status}`}
    >
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}
