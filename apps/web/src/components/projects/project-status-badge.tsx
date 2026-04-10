import { Badge } from "@axle/ui";
import type { ProjectStatus } from "@prisma/client";

const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string }
> = {
  INTAKE: { label: "접수", variant: "outline" },
  DOC_COLLECTING: { label: "서류 수집 중", variant: "secondary" },
  IN_PROGRESS: { label: "진행 중", variant: "default", className: "bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200" },
  REVIEW: { label: "검토 중", variant: "default", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200" },
  SUBMITTED: { label: "제출 완료", variant: "default", className: "bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-200" },
  APPROVED: { label: "승인", variant: "default", className: "bg-green-100 text-green-800 hover:bg-green-100 border-green-200" },
  REJECTED: { label: "반려", variant: "destructive" },
  COMPLETED: { label: "완료", variant: "default", className: "bg-gray-800 text-gray-100 hover:bg-gray-800" },
};

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
}

export function ProjectStatusBadge({ status }: ProjectStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: "secondary" as const };
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}
