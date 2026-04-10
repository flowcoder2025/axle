import { z } from "zod";

const scheduleTypeSchema = z.enum(["DEADLINE", "MEETING", "REMINDER", "PROGRAM_DUE"]);

export const scheduleCreateSchema = z.object({
  title: z.string().min(1, "title is required"),
  description: z.string().optional(),
  type: scheduleTypeSchema,
  startDate: z.string().datetime("startDate must be a valid ISO datetime"),
  endDate: z.string().datetime("endDate must be a valid ISO datetime").optional().nullable(),
  isAllDay: z.boolean().optional().default(false),
  reminderDays: z.array(z.int().nonnegative()).optional().default([7, 3, 1]),
  clientId: z.string().optional(),
  projectId: z.string().optional(),
  programId: z.string().optional(),
});

export const scheduleUpdateSchema = z.object({
  title: z.string().min(1, "title is required").optional(),
  description: z.string().optional().nullable(),
  type: scheduleTypeSchema.optional(),
  startDate: z.string().datetime("startDate must be a valid ISO datetime").optional(),
  endDate: z.string().datetime("endDate must be a valid ISO datetime").optional().nullable(),
  isAllDay: z.boolean().optional(),
  reminderDays: z.array(z.int().nonnegative()).optional(),
  clientId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  programId: z.string().optional().nullable(),
});

export const scheduleQuerySchema = z.object({
  type: scheduleTypeSchema.optional(),
  clientId: z.string().optional(),
  startDateFrom: z.string().datetime().optional(),
  startDateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type ScheduleCreateInput = z.infer<typeof scheduleCreateSchema>;
export type ScheduleUpdateInput = z.infer<typeof scheduleUpdateSchema>;
export type ScheduleQueryParams = z.infer<typeof scheduleQuerySchema>;
