import { z } from "zod";

const ContactSourceEnum = z.enum(["BUSINESS_CARD", "MANUAL", "IMPORT"]);

/**
 * contactCreateSchema — validates the body for POST /api/clients/[clientId]/contacts.
 * clientId is injected from the URL path by the route handler, not accepted from the body.
 */
export const contactCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  position: z.string().optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("invalid email format").optional().or(z.literal("")),
  isPrimary: z.boolean().optional().default(false),
  memo: z.string().optional(),
  source: ContactSourceEnum.optional().default("MANUAL"),
  businessCardUrl: z.string().optional(),
  isResearcher: z.boolean().optional().default(false),
  researchField: z.string().optional(),
});

/**
 * contactUpdateSchema — all fields optional for PATCH.
 */
export const contactUpdateSchema = contactCreateSchema.partial();

export type ContactCreateInput = z.infer<typeof contactCreateSchema>;
export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;
