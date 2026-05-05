import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { Button } from "@axle/ui";
import { ArrowLeft, Pencil } from "lucide-react";
import { ProjectStatusBadge } from "../../../../src/components/projects/project-status-badge";
import { ProjectDetailTabs } from "../../../../src/components/projects/project-detail-tabs";
import {
  BusinessPlanWizard,
  SUPPORTED_PROJECT_TYPES,
} from "../../../../src/components/projects/business-plan-wizard";
import { VentureTechAssessmentButton } from "../../../../src/components/projects/venture-tech-assessment-button";
import { ResearchInstituteNotificationButton } from "../../../../src/components/projects/research-institute-notification-button";
import {
  computeBundleRollup,
  countChecklistDone,
  type RollupChildInput,
} from "../../../../lib/services/bundle-rollup";
import type { FeeType, Priority, ProjectStatus, ProjectType } from "@prisma/client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId },
    select: { title: true },
  });
  return { title: project ? `${project.title} | AXLE` : "프로젝트 상세 | AXLE" };
}

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  const { projectId } = await params;

  if (!user?.orgId) {
    notFound();
  }

  let project;
  try {
    project = await prisma.project.findFirst({
      where: { id: projectId, client: { orgId: user.orgId } },
      include: {
        assignedToUser: { select: { id: true, name: true, email: true } },
        client: { select: { id: true, name: true } },
        _count: { select: { checklist: true, documents: true, members: true } },
        children: {
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            checklist: { select: { status: true } },
            _count: { select: { documents: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  } catch (e) {
    // Diagnostic: surface server-side throw to stdout so CI logs capture the
    // stack. Boundary E2E has been failing for project detail page without
    // visible cause; this lets us see the actual prisma error location.
    console.error("[project-detail-debug] findFirst failed", {
      projectId,
      orgId: user.orgId,
      error: e,
    });
    throw e;
  }

  if (!project) {
    notFound();
  }

  // Resolve program metadata + the org's program catalog for the wizard's
  // selector. Only one of these is surfaced: if the project is pre-linked to a
  // program, we skip the catalog fetch.
  let linkedProgram;
  let availablePrograms;
  try {
    linkedProgram = project.programId
      ? await prisma.programInfo.findFirst({
          where: { id: project.programId },
          select: { id: true, name: true },
        })
      : null;

    availablePrograms = linkedProgram
      ? []
      : await prisma.programInfo.findMany({
          where: { OR: [{ orgId: user.orgId }, { orgId: null }] },
          select: { id: true, name: true, agency: true },
          orderBy: { applicationEnd: "asc" },
          take: 50,
        });
  } catch (e) {
    // Diagnostic: same pattern as the project query above.
    console.error("[project-detail-debug] programInfo lookup failed", {
      projectId,
      orgId: user.orgId,
      programId: project.programId,
      error: e,
    });
    throw e;
  }

  // Serialize for client components
  const serialized = {
    id: project.id,
    title: project.title,
    type: project.type as ProjectType,
    status: project.status as ProjectStatus,
    priority: project.priority as Priority,
    assignedToId: project.assignedToId,
    assignedToUser: project.assignedToUser ?? undefined,
    dueDate: project.dueDate ? project.dueDate.toISOString() : null,
    memo: project.memo,
    feeType: project.feeType as FeeType | null,
    feeAmount: project.feeAmount != null ? Number(project.feeAmount).toString() : null,
    successRate: project.successRate != null ? Number(project.successRate).toString() : null,
    isPaid: project.isPaid,
    client: project.client,
    children: project.children.map((c) => ({
      id: c.id,
      title: c.title,
      type: c.type as ProjectType,
      status: c.status as ProjectStatus,
    })),
  };

  // WI-322: BUNDLE rollup — only computed for parents to keep the non-BUNDLE
  // hot path free of extra work in the render tree.
  const rollup =
    project.type === "BUNDLE"
      ? computeBundleRollup(
          project.children.map<RollupChildInput>((c) => ({
            id: c.id,
            title: c.title,
            type: c.type as string,
            status: c.status as ProjectStatus,
            checklistTotal: c.checklist.length,
            checklistDone: countChecklistDone(c.checklist),
            docsCount: c._count.documents,
          })),
        )
      : null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          프로젝트 목록
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{project.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{project.title}</h1>
            <ProjectStatusBadge status={project.status as ProjectStatus} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>고객사: {project.client.name}</span>
            {project.assignedToUser && <span>담당자: {project.assignedToUser.name ?? project.assignedToUser.email}</span>}
            <span>체크리스트 {project._count.checklist}건</span>
            <span>서류 {project._count.documents}건</span>
            <span>멤버 {project._count.members}명</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {SUPPORTED_PROJECT_TYPES.has(project.type as ProjectType) && (
            <BusinessPlanWizard
              projectId={project.id}
              projectType={project.type as ProjectType}
              linkedProgram={linkedProgram}
              availablePrograms={availablePrograms}
            />
          )}
          {project.type === "VENTURE_CERT" && (
            <VentureTechAssessmentButton projectId={project.id} />
          )}
          {project.type === "RESEARCH_INSTITUTE" && (
            <ResearchInstituteNotificationButton projectId={project.id} />
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/projects/${projectId}/edit`}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              편집
            </Link>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <ProjectDetailTabs project={serialized} rollup={rollup} />
    </div>
  );
}
