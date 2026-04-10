import { Badge } from "@axle/ui";
import type { ProjectType } from "@prisma/client";
import { PROJECT_TYPE_LABELS } from "@/lib/constants/project";

export { PROJECT_TYPE_LABELS };

interface ProjectTypeBadgeProps {
  type: ProjectType;
}

export function ProjectTypeBadge({ type }: ProjectTypeBadgeProps) {
  return (
    <Badge variant="outline" className="font-normal">
      {PROJECT_TYPE_LABELS[type] ?? type}
    </Badge>
  );
}
