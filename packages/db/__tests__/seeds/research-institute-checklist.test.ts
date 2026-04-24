import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  RESEARCH_INSTITUTE_CHECKLIST_TEMPLATES,
  seedResearchInstituteChecklistTemplates,
} from "../../seeds/checklist-templates/research-institute.js";

// Minimal Prisma shim — mirrors patent/venture seeders.
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

describe("RESEARCH_INSTITUTE_CHECKLIST_TEMPLATES data", () => {
  it("has all 3 workflow phases", () => {
    expect(RESEARCH_INSTITUTE_CHECKLIST_TEMPLATES).toHaveLength(3);
    expect(RESEARCH_INSTITUTE_CHECKLIST_TEMPLATES[0].name).toContain("연구원 자격 증빙");
    expect(RESEARCH_INSTITUTE_CHECKLIST_TEMPLATES[1].name).toContain("연구공간");
    expect(RESEARCH_INSTITUTE_CHECKLIST_TEMPLATES[2].name).toContain("신청 서류");
  });

  it("contains exactly 12 items across all phases", () => {
    const allItems = RESEARCH_INSTITUTE_CHECKLIST_TEMPLATES.flatMap((t) => t.items);
    expect(allItems).toHaveLength(12);
  });

  it("covers KOITA core requirement axes (researcher / lab space / equipment / activity plan)", () => {
    const allItems = RESEARCH_INSTITUTE_CHECKLIST_TEMPLATES.flatMap((t) => t.items);
    const names = allItems.map((i) => i.name);
    // Researcher
    expect(names).toContain("연구전담요원 학위·졸업증명서");
    expect(names).toContain("4대 보험 가입자 명부");
    expect(names).toContain("연구전담요원 재직증명서");
    // Lab space
    expect(names).toContain("연구공간 평면도/도면");
    expect(names).toContain("연구공간 사진");
    // Equipment
    expect(names).toContain("보유 기자재·장비 명세서");
    // Activity plan
    expect(names).toContain("연구개발 활동 계획서");
    expect(names).toContain("기업부설연구소·전담부서 인정신청서");
  });

  it("marks 자격증/경력증명서 as optional (alternate qualification path)", () => {
    const allItems = RESEARCH_INSTITUTE_CHECKLIST_TEMPLATES.flatMap((t) => t.items);
    const cert = allItems.find((i) => i.name === "연구전담요원 자격증 사본");
    const career = allItems.find((i) => i.name === "연구전담요원 경력증명서");
    expect(cert?.isRequired).toBe(false);
    expect(career?.isRequired).toBe(false);
  });

  it("binds the final CERTIFICATE item to 기업부설연구소 인정서 (matches project-certificate-auto mapping)", () => {
    const allItems = RESEARCH_INSTITUTE_CHECKLIST_TEMPLATES.flatMap((t) => t.items);
    const cert = allItems.find((i) => i.itemType === "CERTIFICATE");
    expect(cert).toBeDefined();
    expect(cert?.certificateType).toBe("기업부설연구소 인정서");
    expect(cert?.isRequired).toBe(true);
  });

  it("uses DOCUMENT itemType for everything except final certificate", () => {
    const allItems = RESEARCH_INSTITUTE_CHECKLIST_TEMPLATES.flatMap((t) => t.items);
    const nonCert = allItems.filter((i) => i.itemType !== "CERTIFICATE");
    expect(nonCert.every((i) => i.itemType === "DOCUMENT")).toBe(true);
  });
});

describe("seedResearchInstituteChecklistTemplates", () => {
  let mock: ReturnType<typeof makeMockPrisma>;

  beforeEach(() => {
    mock = makeMockPrisma();
  });

  it("creates all templates + items on a fresh DB", async () => {
    const report = await seedResearchInstituteChecklistTemplates(mock as never);
    expect(report.templatesUpserted).toBe(
      RESEARCH_INSTITUTE_CHECKLIST_TEMPLATES.length,
    );
    const expectedItems = RESEARCH_INSTITUTE_CHECKLIST_TEMPLATES.reduce(
      (acc, t) => acc + t.items.length,
      0,
    );
    expect(report.itemsUpserted).toBe(expectedItems);
    expect(mock._templates.size).toBe(
      RESEARCH_INSTITUTE_CHECKLIST_TEMPLATES.length,
    );
    expect(mock._items.size).toBe(expectedItems);
  });

  it("is idempotent — second run creates nothing new", async () => {
    await seedResearchInstituteChecklistTemplates(mock as never);
    const sizesBefore = { t: mock._templates.size, i: mock._items.size };

    const report2 = await seedResearchInstituteChecklistTemplates(mock as never);
    expect(report2.templatesUpserted).toBe(0);
    expect(report2.itemsUpserted).toBe(0);
    expect(mock._templates.size).toBe(sizesBefore.t);
    expect(mock._items.size).toBe(sizesBefore.i);
  });

  it("scopes templates to platform-wide (orgId=null) + RESEARCH_INSTITUTE", async () => {
    await seedResearchInstituteChecklistTemplates(mock as never);
    for (const t of mock._templates.values()) {
      expect(t.orgId).toBeNull();
      expect(t.projectType).toBe("RESEARCH_INSTITUTE");
    }
  });

  it("stores sortOrder matching array index", async () => {
    await seedResearchInstituteChecklistTemplates(mock as never);
    const sorted = [...mock._templates.values()].sort(
      (a, b) => (a.sortOrder as number) - (b.sortOrder as number),
    );
    expect((sorted[0] as unknown as { name: string }).name).toBe(
      RESEARCH_INSTITUTE_CHECKLIST_TEMPLATES[0].name,
    );
    expect(
      (sorted[sorted.length - 1] as unknown as { name: string }).name,
    ).toBe(
      RESEARCH_INSTITUTE_CHECKLIST_TEMPLATES[
        RESEARCH_INSTITUTE_CHECKLIST_TEMPLATES.length - 1
      ].name,
    );
  });

  it("preserves the certificateType (기업부설연구소 인정서) through update path on re-seed", async () => {
    await seedResearchInstituteChecklistTemplates(mock as never);
    await seedResearchInstituteChecklistTemplates(mock as never);
    const cert = [...mock._items.values()].find(
      (i) => i.itemType === "CERTIFICATE",
    );
    expect(cert?.certificateType).toBe("기업부설연구소 인정서");
  });
});
