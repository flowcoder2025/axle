import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { Button } from "@axle/ui";
import { Plus, Video } from "lucide-react";
import { Suspense } from "react";
import { MeetingTable } from "../../../src/components/meetings/meeting-table";
import { Prisma } from "@prisma/client";

export const metadata = {
  title: "미팅 관리 | AXLE",
};

interface SearchParams {
  clientId?: string;
  projectId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: string;
  pageSize?: string;
}

interface MeetingsPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function MeetingsPage({ searchParams }: MeetingsPageProps) {
  const user = await getCurrentUser();
  if (!user?.orgId) notFound();

  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize ?? "20") || 20));
  const skip = (page - 1) * pageSize;

  const clientId = params.clientId?.trim() || undefined;
  const projectId = params.projectId?.trim() || undefined;
  const dateFrom = params.dateFrom ? new Date(params.dateFrom) : undefined;
  const dateTo = params.dateTo ? new Date(params.dateTo + "T23:59:59") : undefined;

  const where: Prisma.MeetingWhereInput = {
    client: { orgId: user.orgId },
    ...(clientId ? { clientId } : {}),
    ...(projectId ? { projectId } : {}),
    ...(dateFrom || dateTo
      ? {
          date: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: dateTo } : {}),
          },
        }
      : {}),
  };

  const [meetings, total] = await Promise.all([
    prisma.meeting.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { date: "desc" },
      select: {
        id: true,
        title: true,
        date: true,
        location: true,
        client: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } },
        _count: { select: { attendees: true, actionItems: true } },
        transcript: { select: { id: true, summary: true } },
      },
    }),
    prisma.meeting.count({ where }),
  ]);

  const serializedMeetings = meetings.map((m) => ({
    ...m,
    date: m.date.toISOString(),
    hasTranscript: !!m.transcript,
    hasSummary: !!m.transcript?.summary,
    transcript: undefined,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">미팅 관리</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            고객사와의 미팅을 기록하고 관리합니다.
          </p>
        </div>
        <Button asChild>
          <Link href="/meetings/new">
            <Plus className="mr-2 h-4 w-4" />
            미팅 추가
          </Link>
        </Button>
      </div>

      {total === 0 && !clientId && !projectId && !dateFrom && !dateTo ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4 text-center">
          <Video className="h-12 w-12 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-lg font-medium">아직 미팅이 없습니다</p>
            <p className="text-sm text-muted-foreground">
              첫 번째 미팅을 등록하고 관리를 시작하세요.
            </p>
          </div>
          <Button asChild>
            <Link href="/meetings/new">
              <Plus className="mr-2 h-4 w-4" />
              미팅 추가
            </Link>
          </Button>
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="py-8 text-center text-muted-foreground">
              불러오는 중...
            </div>
          }
        >
          <MeetingTable
            meetings={serializedMeetings}
            total={total}
            page={page}
            pageSize={pageSize}
            currentClientId={params.clientId}
            currentProjectId={params.projectId}
            currentDateFrom={params.dateFrom}
            currentDateTo={params.dateTo}
          />
        </Suspense>
      )}
    </div>
  );
}
