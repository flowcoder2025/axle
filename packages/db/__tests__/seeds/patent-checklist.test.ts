import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PATENT_CHECKLIST_TEMPLATES,
  seedPatentChecklistTemplates,
} from "../../seeds/checklist-templates/patent.js";

// Minimal Prisma shim — we only exercise the paths the seeder uses.
function makeMockPrisma() {
  const templates = new Map<string, { id: string } & Record<string, unknown>>();
  const items = new Map<string, { id: string } & Record<string, unknown>>();
  let templateSeq = 0;
  let itemSeq = 0;

  return {
    _templates: templates,
    _items: items,
    checklistTemplate: {
      findFirst: vi.fn(
        async ({ where }: { where: Record<string, unknown> }) => {
          for (const t of templates.values()) {
            if (
              t.orgId === where.orgId &&
              t.projectType === where.projectType &&
              t.name === where.name
            ) {
              return { id: t.id };
            }
          }
          return null;
        },
      ),
      create: vi.fn(
        async ({ data }: { data: Record<string, unknown> }) => {
          const id = `template-${++templateSeq}`;
          templates.set(id, { id, ...data });
          return { id };
        },
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const existing = templates.get(where.id)!;
          templates.set(where.id, { ...existing, ...data });
          return { id: where.id };
        },
      ),
    },
    checklistTemplateItem: {
      findFirst: vi.fn(
        async ({ where }: { where: Record<string, unknown> }) => {
          for (const it of items.values()) {
            if (
              it.templateId === where.templateId &&
              it.name === where.name
            ) {
              return { id: it.id };
            }
          }
          return null;
        },
      ),
      create: vi.fn(
        async ({ data }: { data: Record<string, unknown> }) => {
          const id = `item-${++itemSeq}`;
          items.set(id, { id, ...data });
          return { id };
        },
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const existing = items.get(where.id)!;
          items.set(where.id, { ...existing, ...data });
          return { id: where.id };
        },
      ),
    },
  };
}

describe("PATENT_CHECKLIST_TEMPLATES data", () => {
  it("has all 3 workflow phases", () => {
    expect(PATENT_CHECKLIST_TEMPLATES).toHaveLength(3);
    expect(PATENT_CHECKLIST_TEMPLATES[0].name).toContain("발명 신고");
    expect(PATENT_CHECKLIST_TEMPLATES[1].name).toContain("출원 준비");
    expect(PATENT_CHECKLIST_TEMPLATES[2].name).toContain("등록");
  });

  it("contains required 직무발명 documents", () => {
    const allItems = PATENT_CHECKLIST_TEMPLATES.flatMap((t) => t.items);
    const names = allItems.map((i) => i.name);
    expect(names).toContain("직무발명 해당 여부 검토서");
    expect(names).toContain("직무발명 승계(양도) 동의서");
    expect(names).toContain("발명신고서");
  });

  it("binds the final CERTIFICATE item to 특허등록증", () => {
    const allItems = PATENT_CHECKLIST_TEMPLATES.flatMap((t) => t.items);
    const cert = allItems.find((i) => i.itemType === "CERTIFICATE");
    expect(cert).toBeDefined();
    expect(cert?.certificateType).toBe("특허등록증");
  });

  it("uses DOCUMENT itemType for everything except final certificate", () => {
    const allItems = PATENT_CHECKLIST_TEMPLATES.flatMap((t) => t.items);
    const nonCert = allItems.filter((i) => i.itemType !== "CERTIFICATE");
    expect(nonCert.every((i) => i.itemType === "DOCUMENT")).toBe(true);
  });
});

describe("seedPatentChecklistTemplates", () => {
  let mock: ReturnType<typeof makeMockPrisma>;

  beforeEach(() => {
    mock = makeMockPrisma();
  });

  it("creates all templates + items on a fresh DB", async () => {
    const report = await seedPatentChecklistTemplates(mock as never);
    expect(report.templatesUpserted).toBe(PATENT_CHECKLIST_TEMPLATES.length);
    const expectedItems = PATENT_CHECKLIST_TEMPLATES.reduce(
      (acc, t) => acc + t.items.length,
      0,
    );
    expect(report.itemsUpserted).toBe(expectedItems);
    expect(mock._templates.size).toBe(PATENT_CHECKLIST_TEMPLATES.length);
    expect(mock._items.size).toBe(expectedItems);
  });

  it("is idempotent — second run creates nothing new", async () => {
    await seedPatentChecklistTemplates(mock as never);
    const sizesBefore = { t: mock._templates.size, i: mock._items.size };

    const report2 = await seedPatentChecklistTemplates(mock as never);
    expect(report2.templatesUpserted).toBe(0);
    expect(report2.itemsUpserted).toBe(0);
    expect(mock._templates.size).toBe(sizesBefore.t);
    expect(mock._items.size).toBe(sizesBefore.i);
  });

  it("scopes templates to platform-wide (orgId=null) + PATENT", async () => {
    await seedPatentChecklistTemplates(mock as never);
    for (const t of mock._templates.values()) {
      expect(t.orgId).toBeNull();
      expect(t.projectType).toBe("PATENT");
    }
  });

  it("stores sortOrder matching array index", async () => {
    await seedPatentChecklistTemplates(mock as never);
    const sorted = [...mock._templates.values()].sort(
      (a, b) => (a.sortOrder as number) - (b.sortOrder as number),
    );
    expect((sorted[0] as unknown as { name: string }).name).toBe(
      PATENT_CHECKLIST_TEMPLATES[0].name,
    );
    expect(
      (sorted[sorted.length - 1] as unknown as { name: string }).name,
    ).toBe(
      PATENT_CHECKLIST_TEMPLATES[PATENT_CHECKLIST_TEMPLATES.length - 1].name,
    );
  });

  it("refreshes description/isRequired on re-seed (handles spec updates)", async () => {
    await seedPatentChecklistTemplates(mock as never);
    const firstId = [...mock._templates.values()][0].id;
    // Mutate the saved description to simulate an older version.
    mock._templates.get(firstId)!.description = "stale text";

    await seedPatentChecklistTemplates(mock as never);
    expect(mock._templates.get(firstId)!.description).toBe(
      PATENT_CHECKLIST_TEMPLATES[0].description,
    );
  });
});
