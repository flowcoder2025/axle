import { z } from "zod";

export const matchingRunSchema = z.object({
  clientId: z.string().min(1, "clientId is required"),
  programIds: z.array(z.string()).optional(), // if omitted, use all org programs
});

export const matchingQuerySchema = z.object({
  clientId: z.string().min(1, "clientId is required"),
});

export const feedbackSchema = z.object({
  isRelevant: z.boolean(),
  feedbackNote: z.string().optional(),
});

export type MatchingRunInput = z.infer<typeof matchingRunSchema>;
export type MatchingQueryParams = z.infer<typeof matchingQuerySchema>;
export type FeedbackInput = z.infer<typeof feedbackSchema>;
