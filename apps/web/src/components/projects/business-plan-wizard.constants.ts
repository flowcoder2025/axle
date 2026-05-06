import type { ProjectType } from "@prisma/client";

/**
 * Project types that surface the Business Plan wizard.
 *
 * Lives in a non-"use client" module so server components (e.g. the project
 * detail page) can import it without RSC reducing the Set to a serialized
 * proxy that drops `.has`.
 */
export const SUPPORTED_PROJECT_TYPES: ReadonlySet<ProjectType> = new Set<ProjectType>([
  "BUSINESS_PLAN",
  "VENTURE_CERT",
  "RESEARCH_INSTITUTE",
  "BUNDLE",
]);
