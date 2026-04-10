import { z } from "zod";

const projectMemberRoleSchema = z.enum(["LEAD", "MEMBER", "VIEWER"]);

export const projectMemberAddSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  role: projectMemberRoleSchema.optional().default("MEMBER"),
});

export const projectMemberUpdateSchema = z.object({
  role: projectMemberRoleSchema,
});

export type ProjectMemberAddInput = z.infer<typeof projectMemberAddSchema>;
export type ProjectMemberUpdateInput = z.infer<typeof projectMemberUpdateSchema>;
