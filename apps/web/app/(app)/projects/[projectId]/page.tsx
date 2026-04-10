import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { Button } from "@axle/ui";
import { ArrowLeft, Pencil } from "lucide-react";
import { ProjectStatusBadge } from "../../../../src/components/projects/project-status-badge";
import { ProjectDetailTabs } from "../../../../src/components/projects/project-detail-tabs";
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

  const project = await prisma.project.findFirst({
    where: { id: projectId, client: { orgId: user.orgId } },
    include: {
      client: { select: { id: true, name: true } },
      _count: { select: { checklist: true, documents: true, members: true } },
      children: {
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!project) {
    notFound();
  }

  // Serialize for client components
  const serialized = {
    id: project.id,
    title: project.title,
    type: project.type as ProjectType,
    status: project.status as ProjectStatus,
    priority: project.priority as Priority,
    assignedTo: project.assignedTo,
    dueDate: project.dueDate ? project.dueDate.toISOString() : null,
    memo: project.memo,
    feeType: project.feeType as FeeType | null,
    feeAmount: project.feeAmount != null ? project.feeAmount.toString() : null,
    successRate: project.successRate != null ? project.successRate.toString() : null,
    isPaid: project.isPaid,
    client: project.client,
    children: project.children.map((c) => ({
      id: c.id,
      title: c.title,
      type: c.type as ProjectType,
      status: c.status as ProjectStatus,
    })),
  };

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
            {project.assignedTo && <span>담당자: {project.assignedTo}</span>}
            <span>체크리스트 {project._count.checklist}건</span>
            <span>서류 {project._count.documents}건</span>
            <span>멤버 {project._count.members}명</span>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/projects/${projectId}/edit`}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            편집
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <ProjectDetailTabs project={serialized} />
    </div>
  );
}
