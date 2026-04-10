/**
 * project-bundle.ts
 *
 * Creates child projects automatically when a BUNDLE project is created.
 * Default children: VENTURE_CERT, RESEARCH_INSTITUTE, PATENT.
 * Optional SOBOOJANG_CERT can be added via childTypes.
 */

import { prisma } from "@axle/db";
import { type ProjectType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { PROJECT_TYPE_LABELS } from "@/lib/constants/project";

export { PROJECT_TYPE_LABELS };

/** Default child project types created for every BUNDLE */
export const DEFAULT_BUNDLE_CHILD_TYPES: ProjectType[] = [
  "VENTURE_CERT",
  "RESEARCH_INSTITUTE",
  "PATENT",
];

/**
 * Creates child projects for a BUNDLE project inside the provided Prisma
 * transaction context.  Each child gets:
 *   - parentId pointing to the bundle
 *   - title: "{parentTitle} - {typeLabel}"
 *   - same clientId, orgId-scoped checklist templates auto-applied
 *
 * @param tx       - Prisma transaction client
 * @param bundleId - ID of the parent BUNDLE project
 * @param parentTitle - Title of the parent project (used to compose child titles)
 * @param clientId - Client the bundle belongs to
 * @param orgId    - Org used to look up checklist templates
 * @param childTypes - Override for which child types to create (defaults to DEFAULT_BUNDLE_CHILD_TYPES)
 */
export async function createBundleChildren(
  tx: Prisma.TransactionClient,
  bundleId: string,
  parentTitle: string,
  clientId: string,
  orgId: string,
  childTypes: ProjectType[] = DEFAULT_BUNDLE_CHILD_TYPES
): Promise<void> {
  for (const type of childTypes) {
    const label = PROJECT_TYPE_LABELS[type];
    const child = await tx.project.create({
      data: {
        clientId,
        parentId: bundleId,
        type,
        title: `${parentTitle} - ${label}`,
      },
    });

    // Auto-apply checklist templates for the child's project type
    const templates = await tx.checklistTemplate.findMany({
      where: { orgId, projectType: type },
      orderBy: { sortOrder: "asc" },
    });

    if (templates.length > 0) {
      await tx.checklistItem.createMany({
        data: templates.map((tpl) => ({
          projectId: child.id,
          name: tpl.name,
          description: tpl.description,
          isRequired: tpl.isRequired,
        })),
      });
    }
  }
}

/**
 * Top-level helper that wraps createBundleChildren in its own transaction.
 * Use this when you need to create bundle children outside an existing transaction.
 */
export async function createBundleChildrenStandalone(
  bundleId: string,
  parentTitle: string,
  clientId: string,
  orgId: string,
  childTypes?: ProjectType[]
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await createBundleChildren(tx, bundleId, parentTitle, clientId, orgId, childTypes);
  });
}
