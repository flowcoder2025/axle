import { z } from "zod";

const notificationTypeSchema = z.enum([
  "DOC_REQUESTED",
  "DOC_UPLOADED",
  "DOC_EXPIRING",
  "DEADLINE",
  "MEETING_NOTIFY",
  "JOURNAL_DUE",
  "ACTION_ITEM",
  "ACTION_ITEM_DUE",
  "PROJECT_ASSIGNED",
  "MATCHING_RESULT",
  "AI_JOB_COMPLETE",
  "AI_JOB_FAILED",
  "PORTAL_COMPLETE",
  "HANDOFF",
  "ESTIMATE_SENT",
  "BUNDLE_COMPLETE",
]);

export const notificationQuerySchema = z.object({
  type: notificationTypeSchema.optional(),
  isRead: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const notificationCreateSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  type: notificationTypeSchema,
  title: z.string().min(1, "title is required"),
  body: z.string().optional(),
  link: z.string().optional(),
});

export type NotificationQueryParams = z.infer<typeof notificationQuerySchema>;
export type NotificationCreateInput = z.infer<typeof notificationCreateSchema>;
