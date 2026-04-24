/**
 * WI-333-refactor: shared checklist-template seed runner.
 *
 * The 3 platform-wide seeds (PATENT / VENTURE_CERT / RESEARCH_INSTITUTE) all
 * needed the same idempotent upsert logic (find-or-update template, then for
 * each child item find-or-update). Each one had its own ~75-line copy. This
 * module hosts the shared runner so each seed file only owns its data array.
 *
 * Behaviour matches the original implementations exactly (verified by the
 * existing per-type test suites):
 *   - Templates are matched by `(orgId=null, projectType, name)`.
 *   - On match, `description / isRequired / sortOrder` are refreshed.
 *   - On miss, a new template is created.
 *   - Items inside a template are matched by `(templateId, name)` and the
 *     same fields refreshed; new items are created with `sortOrder` derived
 *     from the array index.
 *   - Returned counters reflect *creates only* (mirrors the original
 *     "templatesUpserted" / "itemsUpserted" semantics, which were actually
 *     "newly inserted" — preserved for back-compat with tests).
 */

import type { PrismaClient, ProjectType } from "@prisma/client";

export interface ChecklistTemplateItemDef {
  name: string;
  description: string;
  isRequired: boolean;
  itemType: "DOCUMENT" | "CERTIFICATE";
  certificateType?: string;
}

export interface ChecklistTemplateDef {
  name: string;
  description: string;
  isRequired: boolean;
  items: ChecklistTemplateItemDef[];
}

export interface ChecklistSeedResult {
  templatesUpserted: number;
  itemsUpserted: number;
}

/**
 * Idempotent platform-wide (`orgId = null`) checklist seeder. Re-runnable
 * without dedup risk; safe to invoke during every prisma migrate / db push.
 */
export async function seedChecklistTemplates(
  prisma: PrismaClient,
  projectType: ProjectType,
  defs: readonly ChecklistTemplateDef[],
): Promise<ChecklistSeedResult> {
  let templatesUpserted = 0;
  let itemsUpserted = 0;

  for (let i = 0; i < defs.length; i += 1) {
    const def = defs[i];

    const existing = await prisma.checklistTemplate.findFirst({
      where: { orgId: null, projectType, name: def.name },
      select: { id: true },
    });

    const template = existing
      ? await prisma.checklistTemplate.update({
          where: { id: existing.id },
          data: {
            description: def.description,
            isRequired: def.isRequired,
            sortOrder: i,
          },
          select: { id: true },
        })
      : await prisma.checklistTemplate.create({
          data: {
            orgId: null,
            projectType,
            name: def.name,
            description: def.description,
            isRequired: def.isRequired,
            sortOrder: i,
          },
          select: { id: true },
        });

    if (!existing) templatesUpserted += 1;

    for (let j = 0; j < def.items.length; j += 1) {
      const itemDef = def.items[j];
      const existingItem = await prisma.checklistTemplateItem.findFirst({
        where: { templateId: template.id, name: itemDef.name },
        select: { id: true },
      });
      if (existingItem) {
        await prisma.checklistTemplateItem.update({
          where: { id: existingItem.id },
          data: {
            description: itemDef.description,
            isRequired: itemDef.isRequired,
            itemType: itemDef.itemType,
            certificateType: itemDef.certificateType ?? null,
            sortOrder: j,
          },
        });
      } else {
        await prisma.checklistTemplateItem.create({
          data: {
            templateId: template.id,
            name: itemDef.name,
            description: itemDef.description,
            isRequired: itemDef.isRequired,
            itemType: itemDef.itemType,
            certificateType: itemDef.certificateType ?? null,
            sortOrder: j,
          },
        });
        itemsUpserted += 1;
      }
    }
  }

  return { templatesUpserted, itemsUpserted };
}
