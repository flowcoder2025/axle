import { notFound } from "next/navigation";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import type { ScheduleType } from "@prisma/client";
import { CalendarView } from "../../../src/components/calendar/calendar-view";

export const metadata = {
  title: "캘린더 | AXLE",
};

interface SearchParams {
  year?: string;
  month?: string;
}

interface CalendarPageProps {
  searchParams: Promise<SearchParams>;
}

export type SerializedSchedule = {
  id: string;
  title: string;
  description: string | null;
  type: ScheduleType;
  startDate: string;
  endDate: string | null;
  isAllDay: boolean;
  clientId: string | null;
  projectId: string | null;
  programId: string | null;
  client: { id: string; name: string } | null;
};

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const user = await getCurrentUser();
  if (!user?.orgId) notFound();

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year ?? now.getFullYear());
  const month = Number(params.month ?? now.getMonth() + 1); // 1-indexed

  // Fetch schedules for the displayed range (include prev/next month overflow)
  const rangeStart = new Date(year, month - 2, 1); // one month before
  const rangeEnd = new Date(year, month + 1, 0, 23, 59, 59); // last day of next month

  const schedules = await prisma.schedule.findMany({
    where: {
      orgId: user.orgId,
      startDate: {
        gte: rangeStart,
        lte: rangeEnd,
      },
    },
    orderBy: { startDate: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      startDate: true,
      endDate: true,
      isAllDay: true,
      clientId: true,
      projectId: true,
      programId: true,
      client: { select: { id: true, name: true } },
    },
  });

  const serialized: SerializedSchedule[] = schedules.map((s) => ({
    ...s,
    startDate: s.startDate.toISOString(),
    endDate: s.endDate ? s.endDate.toISOString() : null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">캘린더</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          일정을 월간·주간·일간 뷰로 확인하고 관리합니다.
        </p>
      </div>
      <CalendarView
        schedules={serialized}
        initialYear={year}
        initialMonth={month}
      />
    </div>
  );
}
