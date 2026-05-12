import {
  clearRegistry,
  registerModule,
  registerPack,
  type ModuleConfig,
  type PackConfig,
} from "../src/index.js";

/**
 * Hand-rolled fixture matching wireframes/module-catalog.md.
 * Covers Pack A (no deps, recommended), Pack B (chained hard deps + admin),
 * Pack D (multi-org), Pack E (chained deps, no multi-org), Pack G (desktop).
 */
export const PACK_A: PackConfig = {
  id: "A",
  label: "비즈니스 운영",
  modules: ["customers", "projects", "estimates", "finance"],
  pricing: { monthly: 59000 },
  recommended: true,
};

export const PACK_B: PackConfig = {
  id: "B",
  label: "정부 지원사업",
  modules: ["programs", "matching", "hwpx-admin"],
  pricing: { monthly: 39000 },
};

export const PACK_D: PackConfig = {
  id: "D",
  label: "HR",
  modules: ["employees", "payroll"],
  pricing: { monthly: 49000, perUnit: 1000 },
};

export const PACK_E: PackConfig = {
  id: "E",
  label: "콘텐츠",
  modules: ["create", "presets"],
  pricing: { monthly: 59000 },
};

export const PACK_G: PackConfig = {
  id: "G",
  label: "Desktop",
  modules: ["automation"],
  pricing: { monthly: 29000 },
};

export const MOD_CUSTOMERS: ModuleConfig = {
  id: "customers",
  packId: "A",
  label: "고객",
  route: "/customers",
  permission: "customers:*",
  multiOrg: false,
  pbc: ["consulting-crm"],
  deps: {},
  prismaModels: ["Customer"],
};

export const MOD_PROJECTS: ModuleConfig = {
  id: "projects",
  packId: "A",
  label: "프로젝트",
  route: "/projects",
  permission: "projects:*",
  multiOrg: false,
  pbc: ["consulting-crm"],
  deps: {},
  prismaModels: ["Project"],
};

export const MOD_ESTIMATES: ModuleConfig = {
  id: "estimates",
  packId: "A",
  label: "견적",
  route: "/estimates",
  permission: "estimates:*",
  multiOrg: false,
  pbc: ["consulting-crm"],
  deps: { soft: ["customers"] },
  prismaModels: ["Estimate"],
};

export const MOD_FINANCE: ModuleConfig = {
  id: "finance",
  packId: "A",
  label: "재무",
  route: "/finance",
  permission: "finance:*",
  multiOrg: true,
  pbc: [],
  deps: {},
  prismaModels: ["FinanceLedger"],
};

export const MOD_PROGRAMS: ModuleConfig = {
  id: "programs",
  packId: "B",
  label: "지원사업",
  route: "/programs",
  permission: "programs:*",
  multiOrg: false,
  pbc: ["crawler"],
  deps: {},
  prismaModels: ["Program"],
};

export const MOD_MATCHING: ModuleConfig = {
  id: "matching",
  packId: "B",
  label: "AI 매칭",
  route: "/matching",
  permission: "matching:*",
  multiOrg: true,
  pbc: ["matching"],
  deps: { hard: ["programs"] },
  prismaModels: ["MatchResult"],
};

export const MOD_HWPX_ADMIN: ModuleConfig = {
  id: "hwpx-admin",
  packId: "B",
  label: "HWPX 양식",
  route: "/admin/hwpx",
  permission: "platform:admin",
  multiOrg: false,
  pbc: ["docgen"],
  deps: { hard: ["programs"] },
  prismaModels: ["HwpxTemplate"],
  admin: true,
};

export const MOD_EMPLOYEES: ModuleConfig = {
  id: "employees",
  packId: "D",
  label: "직원",
  route: "/employees",
  permission: "hr:admin",
  multiOrg: true,
  pbc: ["hr-payroll"],
  deps: {},
  prismaModels: ["Employment"],
};

export const MOD_PAYROLL: ModuleConfig = {
  id: "payroll",
  packId: "D",
  label: "급여",
  route: "/payroll",
  permission: "hr:write",
  multiOrg: true,
  pbc: ["hr-payroll"],
  deps: { hard: ["employees"] },
  prismaModels: ["Payroll"],
};

export const MOD_CREATE: ModuleConfig = {
  id: "create",
  packId: "E",
  label: "이미지 생성",
  route: "/create",
  permission: "content:write",
  multiOrg: false,
  pbc: ["image-engine"],
  deps: {},
  prismaModels: ["GeneratedImage"],
};

export const MOD_PRESETS: ModuleConfig = {
  id: "presets",
  packId: "E",
  label: "프리셋",
  route: "/presets",
  permission: "content:read",
  multiOrg: false,
  pbc: ["image-engine"],
  deps: { hard: ["create"] },
  prismaModels: ["Preset"],
};

export const MOD_AUTOMATION: ModuleConfig = {
  id: "automation",
  packId: "G",
  label: "포털 자동화",
  route: "/automation",
  permission: "automation:*",
  multiOrg: false,
  pbc: [],
  deps: {},
  prismaModels: [],
  requiresDesktop: true,
};

export const ALL_MODULES: ModuleConfig[] = [
  MOD_CUSTOMERS,
  MOD_PROJECTS,
  MOD_ESTIMATES,
  MOD_FINANCE,
  MOD_PROGRAMS,
  MOD_MATCHING,
  MOD_HWPX_ADMIN,
  MOD_EMPLOYEES,
  MOD_PAYROLL,
  MOD_CREATE,
  MOD_PRESETS,
  MOD_AUTOMATION,
];

export const ALL_PACKS: PackConfig[] = [PACK_A, PACK_B, PACK_D, PACK_E, PACK_G];

export function seedRegistry(): void {
  clearRegistry();
  for (const mod of ALL_MODULES) registerModule(mod);
  for (const pack of ALL_PACKS) registerPack(pack);
}

/** Hand-rolled in-memory mock of the Prisma OrgModuleInstall table. */
export function createMockPrisma() {
  const rows = new Map<string, { orgId: string; moduleId: string }>();
  const key = (orgId: string, moduleId: string) => `${orgId}::${moduleId}`;

  const prisma = {
    orgModuleInstall: {
      async findMany({ where }: { where: { orgId: string } }) {
        return Array.from(rows.values())
          .filter((r) => r.orgId === where.orgId)
          .map((r) => ({ moduleId: r.moduleId }));
      },
      async findUnique({
        where,
      }: {
        where: { orgId_moduleId: { orgId: string; moduleId: string } };
      }) {
        const k = key(where.orgId_moduleId.orgId, where.orgId_moduleId.moduleId);
        const row = rows.get(k);
        return row ? { moduleId: row.moduleId } : null;
      },
      async create({
        data,
      }: {
        data: { orgId: string; moduleId: string };
      }) {
        rows.set(key(data.orgId, data.moduleId), {
          orgId: data.orgId,
          moduleId: data.moduleId,
        });
        return data;
      },
      async delete({
        where,
      }: {
        where: { orgId_moduleId: { orgId: string; moduleId: string } };
      }) {
        const k = key(where.orgId_moduleId.orgId, where.orgId_moduleId.moduleId);
        const row = rows.get(k);
        rows.delete(k);
        return row;
      },
    },
    /** Test helper — total stored rows across all orgs. */
    _rowCount: () => rows.size,
  };
  return prisma;
}
