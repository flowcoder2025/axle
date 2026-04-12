import { prisma } from "@axle/db";
import { Prisma, ProgramInfo } from "@prisma/client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PROGRAM_DUE_REMINDER_DAYS = [30, 14, 7, 3, 1];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateProgramInput {
  name: string;
  category: string;
  agency?: string;
  announcementUrl?: string | null;
  announcementDocId?: string;
  applicationStart?: string | null;
  applicationEnd?: string | null;
  maxFunding?: number | null;
  requirements?: Record<string, unknown> | null;
  eligibility?: Record<string, unknown> | null;
  region?: string;
  memo?: string;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Creates a program and, if applicationEnd is provided, auto-creates a
 * PROGRAM_DUE schedule with standard reminder days.
 */
export async function createProgramWithDeadlines(
  orgId: string,
  data: CreateProgramInput
): Promise<ProgramInfo> {
  const {
    applicationStart,
    applicationEnd,
    maxFunding,
    requirements,
    eligibility,
    announcementUrl,
    category,
    ...rest
  } = data;

  return prisma.$transaction(async (tx) => {
    const createData: Prisma.ProgramInfoUncheckedCreateInput = {
      ...rest,
      orgId,
      category: category as Prisma.ProgramInfoUncheckedCreateInput["category"],
      announcementUrl: announcementUrl || null,
      applicationStart: applicationStart ? new Date(applicationStart) : null,
      applicationEnd: applicationEnd ? new Date(applicationEnd) : null,
      maxFunding: maxFunding !== undefined && maxFunding !== null ? maxFunding : undefined,
      requirements:
        requirements != null ? (requirements as Prisma.InputJsonValue) : undefined,
      eligibility: eligibility != null ? (eligibility as Prisma.InputJsonValue) : undefined,
    };

    const created = await tx.programInfo.create({ data: createData });

    if (created.applicationEnd) {
      const scheduleData: Prisma.ScheduleUncheckedCreateInput = {
        orgId,
        programId: created.id,
        title: `[마감] ${created.name}`,
        type: "PROGRAM_DUE",
        startDate: created.applicationEnd,
        isAllDay: true,
        reminderDays: PROGRAM_DUE_REMINDER_DAYS,
      };
      await tx.schedule.create({ data: scheduleData });
    }

    return created;
  });
}

/**
 * Syncs the PROGRAM_DUE schedule when applicationEnd changes on a program.
 * - If newEndDate is set and a schedule exists, update it.
 * - If newEndDate is set and no schedule exists, create one.
 * - If newEndDate is null and a schedule exists, delete it.
 *
 * Must be called within an existing transaction (accepts a tx client).
 */
export async function syncDeadlines(
  programId: string,
  orgId: string,
  newEndDate: Date | null,
  programName: string,
  tx: Prisma.TransactionClient
): Promise<void> {
  const existingSchedule = await tx.schedule.findFirst({
    where: { programId, type: "PROGRAM_DUE" },
    select: { id: true },
  });

  if (newEndDate) {
    if (existingSchedule) {
      await tx.schedule.update({
        where: { id: existingSchedule.id },
        data: {
          startDate: newEndDate,
          title: `[마감] ${programName}`,
        },
      });
    } else {
      const scheduleData: Prisma.ScheduleUncheckedCreateInput = {
        orgId,
        programId,
        title: `[마감] ${programName}`,
        type: "PROGRAM_DUE",
        startDate: newEndDate,
        isAllDay: true,
        reminderDays: PROGRAM_DUE_REMINDER_DAYS,
      };
      await tx.schedule.create({ data: scheduleData });
    }
  } else if (existingSchedule) {
    await tx.schedule.delete({ where: { id: existingSchedule.id } });
  }
}

/**
 * Deletes a program and all associated schedules in a transaction.
 */
export async function deleteProgramWithDeadlines(
  programId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.schedule.deleteMany({ where: { programId } });
    await tx.programInfo.delete({ where: { id: programId } });
  });
}
