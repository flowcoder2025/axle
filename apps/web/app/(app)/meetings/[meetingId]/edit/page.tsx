import { notFound } from "next/navigation";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { MeetingForm } from "../../../../../src/components/meetings/meeting-form";

export const metadata = {
  title: "미팅 수정 | AXLE",
};

interface PageProps {
  params: Promise<{ meetingId: string }>;
}

export default async function EditMeetingPage({ params }: PageProps) {
  const user = await getCurrentUser();
  const { meetingId } = await params;

  if (!user?.orgId) notFound();

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, client: { orgId: user.orgId } },
    select: {
      id: true,
      title: true,
      clientId: true,
      projectId: true,
      date: true,
      location: true,
    },
  });

  if (!meeting) notFound();

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

  const meetingDate = new Date(meeting.date);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">미팅 수정</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-medium">{meeting.title}</span>의 정보를 수정합니다.
        </p>
      </div>

      <MeetingForm
        clients={clients}
        projects={projects}
        mode="edit"
        meetingId={meeting.id}
        initialData={{
          title: meeting.title,
          clientId: meeting.clientId,
          projectId: meeting.projectId ?? "",
          date: meetingDate.toISOString().slice(0, 10),
          time: meetingDate.toTimeString().slice(0, 5),
          location: meeting.location ?? "",
        }}
      />
    </div>
  );
}
