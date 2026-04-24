/**
 * WI-331-fix: Single source of truth for "auto-apply checklist templates to a
 * newly-created project."
 *
 * Replaces 4 ad-hoc copies of the same query (apps/web/app/api/projects,
 * meetings/.../create-project, project-bundle, certificate-renewal) which all
 * shared two BLOCKER bugs:
 *
 *   1. Platform-wide (`orgId = null`) seeds were never matched. Every callsite
 *      used `where: { orgId, projectType }`, so the WI-304 / WI-309 / WI-315
 *      seeds (PATENT, VENTURE_CERT, RESEARCH_INSTITUTE) — all seeded with
 *      `orgId = null` — were silently ignored.
 *
 *   2. Only the parent ChecklistTemplate rows were turned into ChecklistItem
 *      rows. The actual ChecklistTemplateItem children (e.g. the 12-item
 *      venture/research evidence list, or the 14-item patent workflow) were
 *      dropped, leaving the project with 3 phase-header items instead of the
 *      full evidence list.
 *
 * Public surface:
 *   - applyChecklistTemplates(tx, args) — the canonical helper. Always use
 *     this from inside a transaction so item creation cannot drift from
 *     project creation.
 */

import type { Prisma, ProjectType } from "@prisma/client";

export interface ApplyChecklistTemplatesArgs {
  projectId: string;
  /** Owning org of the project (used for org-specific templates). */
  orgId: string;
  projectType: ProjectType;
}

export interface ApplyChecklistTemplatesResult {
  /** Number of distinct ChecklistTemplate rows that matched. */
  templatesMatched: number;
  /** Number of ChecklistItem rows actually inserted. */
  itemsCreated: number;
}

/**
 * Find every checklist template that applies to (org, projectType) — including
 * platform-wide (`orgId = null`) seeds — and materialise their items as
 * `ChecklistItem` rows on the target project. Idempotent only if called once
 * per project; do not call twice on the same project (no upsert/dedup logic).
 */
export async function applyChecklistTemplates(
  tx: Prisma.TransactionClient,
  args: ApplyChecklistTemplatesArgs,
): Promise<ApplyChecklistTemplatesResult> {
  const { projectId, orgId, projectType } = args;

  const templates = await tx.checklistTemplate.findMany({
    where: {
      // BLOCKER #1: include both org-specific and platform-wide seeds.
      OR: [{ orgId }, { orgId: null }],
      projectType,
    },
    orderBy: { sortOrder: "asc" },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (templates.length === 0) {
    return { templatesMatched: 0, itemsCreated: 0 };
  }

  const data: Prisma.ChecklistItemCreateManyInput[] = [];

  for (const tpl of templates) {
    if (tpl.items.length === 0) {
      // BACK-COMPAT: a template with no children still produces a single
      // header item — preserves the historical behaviour of org-specific
      // templates created via the Admin UI before WI-315.
      data.push({
        projectId,
        name: tpl.name,
        description: tpl.description ?? null,
        isRequired: tpl.isRequired,
      });
      continue;
    }

    // BLOCKER #2: flatten template + items into ChecklistItem rows. Item
    // names are prefixed with the phase name so the UI's flat list still
    // groups correctly by phase (e.g. "① 기업 기본 서류 - 사업자등록증").
    for (const item of tpl.items) {
      data.push({
        projectId,
        name: `${tpl.name} - ${item.name}`,
        description: item.description ?? null,
        isRequired: item.isRequired,
        itemType: item.itemType,
        certificateType: item.certificateType ?? null,
      });
    }
  }

  if (data.length === 0) {
    return { templatesMatched: templates.length, itemsCreated: 0 };
  }

  await tx.checklistItem.createMany({ data });
  return { templatesMatched: templates.length, itemsCreated: data.length };
}
