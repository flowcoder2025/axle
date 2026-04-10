import { z } from "zod";

export const meetingCreateSchema = z.object({
  title: z.string().min(1, "title is required"),
  clientId: z.string().min(1, "clientId is required"),
  date: z.string().datetime("date must be a valid ISO 8601 datetime"),
  projectId: z.string().optional(),
  location: z.string().optional(),
  attendees: z
    .array(
      z.object({
        name: z.string().min(1, "attendee name is required"),
        contactId: z.string().optional(),
        userId: z.string().optional(),
        role: z.string().optional(),
      })
    )
    .optional(),
});

export const meetingUpdateSchema = meetingCreateSchema
  .omit({ attendees: true })
  .partial();

export const meetingQuerySchema = z.object({
  clientId: z.string().optional(),
  projectId: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const attendeeSchema = z.object({
  name: z.string().min(1, "name is required"),
  contactId: z.string().optional(),
  userId: z.string().optional(),
  role: z.string().optional(),
});

export type MeetingCreateInput = z.infer<typeof meetingCreateSchema>;
export type MeetingUpdateInput = z.infer<typeof meetingUpdateSchema>;
export type MeetingQueryParams = z.infer<typeof meetingQuerySchema>;
export type AttendeeInput = z.infer<typeof attendeeSchema>;
