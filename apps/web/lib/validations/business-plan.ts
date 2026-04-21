import { z } from "zod";

/**
 * WI-202 — POST /api/business-plans request body schema.
 *
 * - `projectId`  : required; pipeline resolves clientId + program context from it
 * - `programId`  : optional override; when omitted, uses project.programId
 * - `sections`   : optional subset of REQUIRED_SECTIONS to regenerate. Empty/omitted = all
 * - `engine`     : 'rag' = draft only, 'precision' = draft + docx, 'both' (default) = full pipeline
 */
export const businessPlanCreateSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  programId: z.string().min(1).optional(),
  sections: z.array(z.string().min(1)).optional(),
  engine: z.enum(["rag", "precision", "both"]).default("both"),
});

export type BusinessPlanCreateInput = z.infer<typeof businessPlanCreateSchema>;
