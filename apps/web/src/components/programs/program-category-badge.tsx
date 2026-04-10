import { Badge } from "@axle/ui";
import type { ProgramCategory } from "@prisma/client";

interface ProgramCategoryBadgeProps {
  category: ProgramCategory;
}

const CATEGORY_CONFIG: Record<
  ProgramCategory,
  { label: string; className: string }
> = {
  STARTUP: {
    label: "창업",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  VENTURE: {
    label: "벤처",
    className: "bg-purple-100 text-purple-800 border-purple-200",
  },
  RND: {
    label: "R&D",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  CERTIFICATION: {
    label: "인증",
    className: "bg-orange-100 text-orange-800 border-orange-200",
  },
  EXPORT: {
    label: "수출",
    className: "bg-indigo-100 text-indigo-800 border-indigo-200",
  },
  SMART_FACTORY: {
    label: "스마트공장",
    className: "bg-red-100 text-red-800 border-red-200",
  },
  GENERAL: {
    label: "일반",
    className: "bg-gray-100 text-gray-700 border-gray-200",
  },
};

export const PROGRAM_CATEGORY_LABELS: Record<ProgramCategory, string> = {
  STARTUP: "창업",
  VENTURE: "벤처",
  RND: "R&D",
  CERTIFICATION: "인증",
  EXPORT: "수출",
  SMART_FACTORY: "스마트공장",
  GENERAL: "일반",
};

export function ProgramCategoryBadge({ category }: ProgramCategoryBadgeProps) {
  const config = CATEGORY_CONFIG[category] ?? {
    label: category,
    className: "bg-gray-100 text-gray-700 border-gray-200",
  };
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
