import { Badge } from "@axle/ui";

type ClientStatus = "ACTIVE" | "INACTIVE" | "PROSPECT";

interface ClientStatusBadgeProps {
  status: ClientStatus;
}

const STATUS_CONFIG: Record<
  ClientStatus,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  ACTIVE: { label: "활성", variant: "default" },
  INACTIVE: { label: "비활성", variant: "secondary" },
  PROSPECT: { label: "잠재", variant: "outline" },
};

export function ClientStatusBadge({ status }: ClientStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
