import { z } from "zod";
import { PORTAL_KINDS } from "./scraper-job";

/**
 * Account credentials (userId / userPw) for portals that authenticate without
 * a public certificate (Minwon24, NHIS, etc.).
 */
export const portalAccountCreateSchema = z.object({
  portal: z.enum(PORTAL_KINDS),
  userId: z.string().trim().min(1).max(120),
  password: z.string().min(1).max(200),
});

export type PortalAccountCreateInput = z.infer<typeof portalAccountCreateSchema>;

/**
 * Certificate upload requires the PFX bag base64-encoded plus its password.
 * We bound the size at ~4 MB raw (≈5.5 MB base64) — typical Korean public
 * certs are <50 KB, so generous headroom keeps us safe from DoS while
 * still working with rarer combined bundles.
 */
export const portalCertificateCreateSchema = z.object({
  pfxBase64: z
    .string()
    .min(1)
    .max(6_000_000, "PFX file is too large (max ~4MB)"),
  password: z.string().min(1).max(200),
});

export type PortalCertificateCreateInput = z.infer<
  typeof portalCertificateCreateSchema
>;
