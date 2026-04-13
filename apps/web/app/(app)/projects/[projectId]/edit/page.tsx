import { notFound } from "next/navigation";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { ProjectForm } from "../../../../../src/components/projects/project-form";

export const metadata = {
  title: "프로젝트 수정 | AXLE",
};

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function EditProjectPage({ params }: PageProps) {
  const user = await getCurrentUser();
  const { projectId } = await params;

  if (!user?.orgId) notFound();

  const project = await prisma.project.findFirst({
    where: { id: projectId, client: { orgId: user.orgId } },
    select: {
      id: true,
      clientId: true,
      title: true,
      type: true,
      priority: true,
      assignedToId: true,
      dueDate: true,
      memo: true,
      feeType: true,
      feeAmount: true,
      successRate: true,
      isPaid: true,
      client: { select: { id: true, name: true } },
    },
  });

  if (!project) notFound();

  const clients = await prisma.client.findMany({
    where: { orgId: user.orgId, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">프로젝트 수정</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-medium">{project.title}</span>의 정보를 수정합니다.
        </p>
      </div>

      <ProjectForm
        clients={clients}
        mode="edit"
        projectId={project.id}
        initialData={{
          clientId: project.clientId,
          title: project.title,
          type: project.type,
          priority: project.priority,
          assignedToId: project.assignedToId ?? "",
          dueDate: project.dueDate
            ? project.dueDate.toISOString().slice(0, 10)
            : "",
          memo: project.memo ?? "",
          feeType: project.feeType ?? "",
          feeAmount: project.feeAmount != null ? String(Number(project.feeAmount)) : "",
          successRate: project.successRate != null ? String(Number(project.successRate)) : "",
          isPaid: project.isPaid,
          childTypes: [],
        }}
      />
    </div>
  );
}
