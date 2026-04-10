import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { Button } from "@axle/ui";
import { ProjectTable } from "../../../src/components/projects/project-table";
import { ProjectKanban } from "../../../src/components/projects/project-kanban";
import { ProjectViewToggle } from "../../../src/components/projects/project-view-toggle";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import type { ProjectType, ProjectStatus } from "@prisma/client";

export const metadata = {
  title: "프로젝트 관리 | AXLE",
};

const VALID_TYPES: ProjectType[] = [
  "BUSINESS_PLAN",
  "VENTURE_CERT",
  "SOBOOJANG_CERT",
  "RESEARCH_INSTITUTE",
  "PATENT",
  "FINANCIAL_ANALYSIS",
  "RESEARCH_TASK",
  "BUNDLE",
];

const VALID_STATUSES: ProjectStatus[] = [
  "INTAKE",
  "DOC_COLLECTING",
  "IN_PROGRESS",
  "REVIEW",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
];

interface SearchParams {
  q?: string;
  type?: string;
  status?: string;
  assignedTo?: string;
  clientId?: string;
  page?: string;
  pageSize?: string;
  sortBy?: string;
  sortOrder?: string;
  view?: string;
}

interface ProjectsPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const user = await getCurrentUser();
  if (!user?.orgId) notFound();

  const params = await searchParams;

  const viewMode = params.view === "kanban" ? "kanban" : "table";
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize ?? "20") || 20));
  const skip = (page - 1) * pageSize;
  const type = VALID_TYPES.includes(params.type as ProjectType)
    ? (params.type as ProjectType)
    : undefined;
  const status = VALID_STATUSES.includes(params.status as ProjectStatus)
    ? (params.status as ProjectStatus)
    : undefined;
  const assignedTo = params.assignedTo?.trim() || undefined;
  const clientId = params.clientId?.trim() || undefined;

  const where = {
    client: { orgId: user.orgId },
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(assignedTo ? { assignedTo } : {}),
    ...(clientId ? { clientId } : {}),
  };

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        assignedTo: true,
        dueDate: true,
        client: { select: { name: true } },
      },
    }),
    prisma.project.count({ where }),
  ]);

  // Serialize dates for client component
  const serializedProjects = projects.map((p) => ({
    ...p,
    dueDate: p.dueDate ? p.dueDate.toISOString() : null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">프로젝트 관리</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            등록된 프로젝트를 조회하고 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Suspense>
            <ProjectViewToggle currentView={viewMode} />
          </Suspense>
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="mr-2 h-4 w-4" />
              프로젝트 추가
            </Link>
          </Button>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="py-8 text-center text-muted-foreground">
            불러오는 중...
          </div>
        }
      >
        {viewMode === "kanban" ? (
          <ProjectKanban projects={serializedProjects} />
        ) : (
          <ProjectTable
            projects={serializedProjects}
            total={total}
            page={page}
            pageSize={pageSize}
            currentType={params.type}
            currentStatus={params.status}
            currentSortBy={params.sortBy}
            currentSortOrder={params.sortOrder}
          />
        )}
      </Suspense>
    </div>
  );
}
