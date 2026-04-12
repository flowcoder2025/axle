import { prisma } from "@axle/db";
import { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScheduleFilters {
  type?: string;
  clientId?: string;
  startDateFrom?: string;
  startDateTo?: string;
  page: number;
  pageSize: number;
}

export interface ScheduleListResult {
  schedules: any[];
  total: number;
}

export interface ScheduleCreateData {
  title: string;
  description?: string;
  type: string;
  startDate: string;
  endDate?: string | null;
  isAllDay?: boolean;
  reminderDays?: number[];
  clientId?: string;
  projectId?: string;
  programId?: string;
}

export interface ScheduleUpdateData {
  title?: string;
  description?: string | null;
  type?: string;
  startDate?: string;
  endDate?: string | null;
  isAllDay?: boolean;
  reminderDays?: number[];
  clientId?: string | null;
  projectId?: string | null;
  programId?: string | null;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export async function listSchedules(
  orgId: string,
  filters: ScheduleFilters
): Promise<ScheduleListResult> {
  const { type, clientId, startDateFrom, startDateTo, page, pageSize } = filters;
  const skip = (page - 1) * pageSize;

  const where: Prisma.ScheduleWhereInput = {
    orgId,
    ...(type ? { type: type as Prisma.ScheduleWhereInput["type"] } : {}),
    ...(clientId ? { clientId } : {}),
    ...(startDateFrom || startDateTo
      ? {
          startDate: {
            ...(startDateFrom ? { gte: new Date(startDateFrom) } : {}),
            ...(startDateTo ? { lte: new Date(startDateTo) } : {}),
          },
        }
      : {}),
  };

  const [schedules, total] = await Promise.all([
    prisma.schedule.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        orgId: true,
        clientId: true,
        projectId: true,
        programId: true,
        title: true,
        description: true,
        type: true,
        startDate: true,
        endDate: true,
        isAllDay: true,
        reminderDays: true,
        googleCalendarId: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
        program: { select: { id: true, name: true } },
      },
    }),
    prisma.schedule.count({ where }),
  ]);

  return { schedules, total };
}

export async function createSchedule(
  orgId: string,
  data: ScheduleCreateData
): Promise<any> {
  const { startDate, endDate, type, ...rest } = data;

  const createData: Prisma.ScheduleUncheckedCreateInput = {
    orgId,
    title: rest.title,
    type: type as Prisma.ScheduleUncheckedCreateInput["type"],
    startDate: new Date(startDate),
    endDate: endDate ? new Date(endDate) : undefined,
    ...(rest.description !== undefined ? { description: rest.description } : {}),
    ...(rest.isAllDay !== undefined ? { isAllDay: rest.isAllDay } : {}),
    ...(rest.reminderDays !== undefined ? { reminderDays: rest.reminderDays } : {}),
    ...(rest.clientId !== undefined ? { clientId: rest.clientId } : {}),
    ...(rest.projectId !== undefined ? { projectId: rest.projectId } : {}),
    ...(rest.programId !== undefined ? { programId: rest.programId } : {}),
  };

  return prisma.schedule.create({ data: createData });
}

export async function getSchedule(
  id: string,
  orgId: string
): Promise<any | null> {
  return prisma.schedule.findFirst({
    where: { id, orgId },
    include: {
      client: { select: { id: true, name: true } },
      program: { select: { id: true, name: true } },
    },
  });
}

export async function updateSchedule(
  id: string,
  orgId: string,
  data: ScheduleUpdateData
): Promise<any | null> {
  const existing = await prisma.schedule.findFirst({
    where: { id, orgId },
    select: { id: true },
  });

  if (!existing) {
    return null;
  }

  const { startDate, endDate, type, ...rest } = data;

  const updateData: Prisma.ScheduleUncheckedUpdateInput = {
    ...(rest.title !== undefined ? { title: rest.title } : {}),
    ...(rest.description !== undefined ? { description: rest.description } : {}),
    ...(type !== undefined ? { type: type as Prisma.ScheduleUncheckedUpdateInput["type"] } : {}),
    ...(startDate !== undefined ? { startDate: new Date(startDate) } : {}),
    ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
    ...(rest.isAllDay !== undefined ? { isAllDay: rest.isAllDay } : {}),
    ...(rest.reminderDays !== undefined ? { reminderDays: rest.reminderDays } : {}),
    ...(rest.clientId !== undefined ? { clientId: rest.clientId } : {}),
    ...(rest.projectId !== undefined ? { projectId: rest.projectId } : {}),
    ...(rest.programId !== undefined ? { programId: rest.programId } : {}),
  };

  return prisma.schedule.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteSchedule(
  id: string,
  orgId: string
): Promise<boolean> {
  const existing = await prisma.schedule.findFirst({
    where: { id, orgId },
    select: { id: true },
  });

  if (!existing) {
    return false;
  }

  await prisma.schedule.delete({ where: { id } });
  return true;
}
