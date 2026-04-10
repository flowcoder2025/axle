import { notFound } from "next/navigation";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { MeetingForm } from "../../../../src/components/meetings/meeting-form";

export const metadata = {
  title: "미팅 추가 | AXLE",
};

export default async function NewMeetingPage() {
  const user = await getCurrentUser();
  if (!user?.orgId) notFound();

  const [clients, projects] = await Promise.all([
    prisma.client.findMany({
      where: { orgId: user.orgId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      where: { client: { orgId: user.orgId } },
      orderBy: { title: "asc" },
      select: { id: true, title: true, clientId: true },
    }),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">미팅 추가</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          새로운 미팅을 등록합니다.
        </p>
      </div>

      <MeetingForm clients={clients} projects={projects} />
    </div>
  );
}
