import { notFound } from "next/navigation";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { ProjectForm } from "../../../../src/components/projects/project-form";

export const metadata = {
  title: "프로젝트 추가 | AXLE",
};

export default async function NewProjectPage() {
  const user = await getCurrentUser();
  if (!user?.orgId) notFound();

  const clients = await prisma.client.findMany({
    where: { orgId: user.orgId, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">프로젝트 추가</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          새로운 프로젝트를 등록합니다.
        </p>
      </div>

      <ProjectForm clients={clients} />
    </div>
  );
}
