import Link from "next/link";
import { ProjectStatusBadge } from "./project-status-badge";
import { ProjectTypeBadge } from "./project-type-badge";
import { ProjectStatusControls } from "./project-status-controls";
import type { ProjectStatus, ProjectType, Priority, FeeType } from "@prisma/client";

const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "낮음",
  MEDIUM: "보통",
  HIGH: "높음",
  URGENT: "긴급",
};

const FEE_TYPE_LABELS: Record<FeeType, string> = {
  FIXED: "고정 수수료",
  SUCCESS_RATE: "성공 보수",
  MONTHLY: "월정액",
};

interface ChildProject {
  id: string;
  title: string;
  type: ProjectType;
  status: ProjectStatus;
}

interface ProjectOverviewProps {
  project: {
    id: string;
    title: string;
    type: ProjectType;
    status: ProjectStatus;
    priority: Priority;
    assignedTo: string | null;
    dueDate: string | null;
    memo: string | null;
    feeType: FeeType | null;
    feeAmount: string | null;
    successRate: string | null;
    isPaid: boolean;
    client: { id: string; name: string };
    children: ChildProject[];
  };
}

function formatDate(iso: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function ProjectOverview({ project }: ProjectOverviewProps) {
  const infoRows: Array<{ label: string; value: React.ReactNode }> = [
    { label: "고객사", value: (
      <Link href={`/clients/${project.client.id}`} className="text-primary hover:underline">
        {project.client.name}
      </Link>
    )},
    { label: "유형", value: <ProjectTypeBadge type={project.type} /> },
    { label: "우선순위", value: PRIORITY_LABELS[project.priority] },
    { label: "담당자", value: project.assignedTo ?? "-" },
    { label: "마감일", value: formatDate(project.dueDate) },
    { label: "메모", value: project.memo ?? "-" },
  ];

  const hasFeeInfo = project.feeType != null;

  return (
    <div className="space-y-6">
      {/* Status section */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">현재 상태</span>
          <ProjectStatusBadge status={project.status} />
        </div>
        <ProjectStatusControls projectId={project.id} currentStatus={project.status} />
      </div>

      {/* Basic info */}
      <div className="rounded-lg border">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">기본 정보</h3>
        </div>
        <dl className="divide-y">
          {infoRows.map(({ label, value }) => (
            <div key={label} className="grid grid-cols-3 gap-4 px-4 py-3">
              <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
              <dd className="col-span-2 text-sm">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Fee info */}
      {hasFeeInfo && (
        <div className="rounded-lg border">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-semibold">수수료 정보</h3>
          </div>
          <dl className="divide-y">
            <div className="grid grid-cols-3 gap-4 px-4 py-3">
              <dt className="text-sm font-medium text-muted-foreground">수수료 유형</dt>
              <dd className="col-span-2 text-sm">{FEE_TYPE_LABELS[project.feeType!]}</dd>
            </div>
            {project.feeAmount != null && (
              <div className="grid grid-cols-3 gap-4 px-4 py-3">
                <dt className="text-sm font-medium text-muted-foreground">금액</dt>
                <dd className="col-span-2 text-sm">
                  {Number(project.feeAmount).toLocaleString("ko-KR")}원
                </dd>
              </div>
            )}
            {project.successRate != null && (
              <div className="grid grid-cols-3 gap-4 px-4 py-3">
                <dt className="text-sm font-medium text-muted-foreground">성공 보수율</dt>
                <dd className="col-span-2 text-sm">{project.successRate}%</dd>
              </div>
            )}
            <div className="grid grid-cols-3 gap-4 px-4 py-3">
              <dt className="text-sm font-medium text-muted-foreground">납부 여부</dt>
              <dd className="col-span-2 text-sm">
                <span className={project.isPaid ? "text-green-700 font-medium" : "text-muted-foreground"}>
                  {project.isPaid ? "납부 완료" : "미납"}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* Bundle tree */}
      {project.type === "BUNDLE" && project.children.length > 0 && (
        <div className="rounded-lg border">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-semibold">하위 프로젝트</h3>
          </div>
          <ul className="divide-y">
            {project.children.map((child) => (
              <li key={child.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <ProjectTypeBadge type={child.type} />
                  <Link
                    href={`/projects/${child.id}`}
                    className="text-sm font-medium hover:underline truncate"
                  >
                    {child.title}
                  </Link>
                </div>
                <ProjectStatusBadge status={child.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
