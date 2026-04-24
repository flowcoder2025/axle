import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  VENTURE_CHECKLIST_TEMPLATES,
  seedVentureChecklistTemplates,
} from "../../seeds/checklist-templates/venture.js";

// Minimal Prisma shim — mirrors patent-checklist.test.ts.
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

describe("VENTURE_CHECKLIST_TEMPLATES data", () => {
  it("has all 3 workflow phases", () => {
    expect(VENTURE_CHECKLIST_TEMPLATES).toHaveLength(3);
    expect(VENTURE_CHECKLIST_TEMPLATES[0].name).toContain("기업 기본 서류");
    expect(VENTURE_CHECKLIST_TEMPLATES[1].name).toContain("연구개발");
    expect(VENTURE_CHECKLIST_TEMPLATES[2].name).toContain("신청 서류");
  });

  it("contains exactly 12 items across all phases (per WI-304 spec)", () => {
    const allItems = VENTURE_CHECKLIST_TEMPLATES.flatMap((t) => t.items);
    expect(allItems).toHaveLength(12);
  });

  it("covers the three certification axes (R&D facility, headcount, finance)", () => {
    const allItems = VENTURE_CHECKLIST_TEMPLATES.flatMap((t) => t.items);
    const names = allItems.map((i) => i.name);
    // R&D facility
    expect(names).toContain("기업부설연구소·전담부서 인정서");
    // Headcount
    expect(names).toContain("연구전담요원 학력증명서");
    expect(names).toContain("연구전담요원 재직증명서");
    // Finance
    expect(names).toContain("연구개발비 집행 내역");
    expect(names).toContain("매출액 대비 연구개발비 비율 산정표");
    expect(names).toContain("최근 3년 재무제표");
  });

  it("includes the WI-301 generator output (벤처확인용 사업계획서) as a required item", () => {
    const allItems = VENTURE_CHECKLIST_TEMPLATES.flatMap((t) => t.items);
    const planItem = allItems.find((i) => i.name === "벤처확인용 사업계획서");
    expect(planItem).toBeDefined();
    expect(planItem?.isRequired).toBe(true);
    expect(planItem?.itemType).toBe("DOCUMENT");
  });

  it("binds the final CERTIFICATE item to 벤처기업확인서 (matches project-certificate-auto mapping)", () => {
    const allItems = VENTURE_CHECKLIST_TEMPLATES.flatMap((t) => t.items);
    const cert = allItems.find((i) => i.itemType === "CERTIFICATE");
    expect(cert).toBeDefined();
    expect(cert?.certificateType).toBe("벤처기업확인서");
  });

  it("uses DOCUMENT itemType for everything except final certificate", () => {
    const allItems = VENTURE_CHECKLIST_TEMPLATES.flatMap((t) => t.items);
    const nonCert = allItems.filter((i) => i.itemType !== "CERTIFICATE");
    expect(nonCert.every((i) => i.itemType === "DOCUMENT")).toBe(true);
  });

  it("marks all phases and the cert item as required", () => {
    expect(VENTURE_CHECKLIST_TEMPLATES.every((t) => t.isRequired)).toBe(true);
    const allItems = VENTURE_CHECKLIST_TEMPLATES.flatMap((t) => t.items);
    expect(allItems.find((i) => i.itemType === "CERTIFICATE")?.isRequired).toBe(
      true,
    );
  });
});

describe("seedVentureChecklistTemplates", () => {
  let mock: ReturnType<typeof makeMockPrisma>;

  beforeEach(() => {
    mock = makeMockPrisma();
  });

  it("creates all templates + items on a fresh DB", async () => {
    const report = await seedVentureChecklistTemplates(mock as never);
    expect(report.templatesUpserted).toBe(VENTURE_CHECKLIST_TEMPLATES.length);
    const expectedItems = VENTURE_CHECKLIST_TEMPLATES.reduce(
      (acc, t) => acc + t.items.length,
      0,
    );
    expect(report.itemsUpserted).toBe(expectedItems);
    expect(mock._templates.size).toBe(VENTURE_CHECKLIST_TEMPLATES.length);
    expect(mock._items.size).toBe(expectedItems);
  });

  it("is idempotent — second run creates nothing new", async () => {
    await seedVentureChecklistTemplates(mock as never);
    const sizesBefore = { t: mock._templates.size, i: mock._items.size };

    const report2 = await seedVentureChecklistTemplates(mock as never);
    expect(report2.templatesUpserted).toBe(0);
    expect(report2.itemsUpserted).toBe(0);
    expect(mock._templates.size).toBe(sizesBefore.t);
    expect(mock._items.size).toBe(sizesBefore.i);
  });

  it("scopes templates to platform-wide (orgId=null) + VENTURE_CERT", async () => {
    await seedVentureChecklistTemplates(mock as never);
    for (const t of mock._templates.values()) {
      expect(t.orgId).toBeNull();
      expect(t.projectType).toBe("VENTURE_CERT");
    }
  });

  it("stores sortOrder matching array index", async () => {
    await seedVentureChecklistTemplates(mock as never);
    const sorted = [...mock._templates.values()].sort(
      (a, b) => (a.sortOrder as number) - (b.sortOrder as number),
    );
    expect((sorted[0] as unknown as { name: string }).name).toBe(
      VENTURE_CHECKLIST_TEMPLATES[0].name,
    );
    expect(
      (sorted[sorted.length - 1] as unknown as { name: string }).name,
    ).toBe(
      VENTURE_CHECKLIST_TEMPLATES[VENTURE_CHECKLIST_TEMPLATES.length - 1].name,
    );
  });

  it("refreshes description/isRequired on re-seed (handles spec updates)", async () => {
    await seedVentureChecklistTemplates(mock as never);
    const firstId = [...mock._templates.values()][0].id;
    mock._templates.get(firstId)!.description = "stale text";

    await seedVentureChecklistTemplates(mock as never);
    expect(mock._templates.get(firstId)!.description).toBe(
      VENTURE_CHECKLIST_TEMPLATES[0].description,
    );
  });

  it("preserves the certificateType (벤처기업확인서) through update path on re-seed", async () => {
    await seedVentureChecklistTemplates(mock as never);
    await seedVentureChecklistTemplates(mock as never);
    const cert = [...mock._items.values()].find(
      (i) => i.itemType === "CERTIFICATE",
    );
    expect(cert?.certificateType).toBe("벤처기업확인서");
  });
});
