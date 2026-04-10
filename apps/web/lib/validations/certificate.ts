import { z } from "zod";

/**
 * certificateCreateSchema — validates the body for POST /api/clients/[clientId]/certificates.
 * clientId is injected from the URL path by the route handler, not accepted from the body.
 */
export const certificateCreateSchema = z.object({
  type: z.string().min(1, "Type is required"),
  subjectName: z.string().min(1, "Subject name is required"),
  serialNumber: z.string().optional(),
  validFrom: z.string().datetime({ offset: true }).optional(),
  validTo: z.string().datetime({ offset: true }).optional(),
  storagePath: z.string().optional(),
  isActive: z.boolean().optional().default(true),
});

/**
 * certificateUpdateSchema — all fields optional for PATCH.
 */
export const certificateUpdateSchema = certificateCreateSchema.partial();

export type CertificateCreateInput = z.infer<typeof certificateCreateSchema>;
export type CertificateUpdateInput = z.infer<typeof certificateUpdateSchema>;
