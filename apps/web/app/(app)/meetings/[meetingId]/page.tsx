import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { Button } from "@axle/ui";
import { ArrowLeft, Pencil } from "lucide-react";
import { MeetingDetailTabs } from "../../../../src/components/meetings/meeting-detail-tabs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const { meetingId } = await params;
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId },
    select: { title: true },
  });
  return {
    title: meeting ? `${meeting.title} | AXLE` : "미팅 상세 | AXLE",
  };
}

interface PageProps {
  params: Promise<{ meetingId: string }>;
}

function formatDate(date: Date) {
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function MeetingDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  const { meetingId } = await params;

  if (!user?.orgId) notFound();

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, client: { orgId: user.orgId } },
    include: {
      client: { select: { id: true, name: true } },
      project: { select: { id: true, title: true } },
      attendees: true,
      transcript: true,
      actionItems: { orderBy: { status: "asc" } },
    },
  });

  if (!meeting) notFound();

  // Serialize for client components
  const serializedMeeting = {
    id: meeting.id,
    title: meeting.title,
    date: meeting.date.toISOString(),
    location: meeting.location,
    clientId: meeting.clientId,
    client: meeting.client,
    project: meeting.project,
    recordingUrl: meeting.recordingUrl,
    attendees: meeting.attendees.map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      contactId: a.contactId,
      userId: a.userId,
    })),
    transcript: meeting.transcript
      ? {
          id: meeting.transcript.id,
          rawTranscript: meeting.transcript.rawTranscript,
          summary: meeting.transcript.summary,
          keyDecisions: meeting.transcript.keyDecisions,
          aiJobId: meeting.transcript.aiJobId,
          aiJob: meeting.transcript.aiJobId
            ? await prisma.aiJob
                .findUnique({
                  where: { id: meeting.transcript.aiJobId },
                  select: { status: true, errorMessage: true },
                })
                .then((j) => (j ? { status: j.status, errorMessage: j.errorMessage } : null))
            : null,
        }
      : null,
    actionItems: meeting.actionItems.map((a) => ({
      id: a.id,
      description: a.description,
      status: a.status as "OPEN" | "IN_PROGRESS" | "DONE",
      dueDate: a.dueDate ? a.dueDate.toISOString() : null,
      assigneeUserId: a.assigneeUserId,
      assigneeContactId: a.assigneeContactId,
      linkedChecklistId: a.linkedChecklistId,
    })),
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/meetings"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          미팅 목록
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{meeting.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{meeting.title}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{meeting.client.name}</span>
            <span>{formatDate(meeting.date)}</span>
            {meeting.location && <span>{meeting.location}</span>}
            <span>참석자 {meeting.attendees.length}명</span>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/meetings/${meetingId}/edit`}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            편집
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <MeetingDetailTabs meeting={serializedMeeting} />
    </div>
  );
}
