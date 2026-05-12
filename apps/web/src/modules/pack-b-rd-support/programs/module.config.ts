import type { ModuleConfig } from "@axle/core-module-system";

export const programsModule: ModuleConfig = {
  id: "programs",
  packId: "B",
  label: "지원사업",
  icon: "Landmark",
  route: "/programs",
  permission: "programs:read",
  multiOrg: false,
  pbc: [],
  deps: {},
  prismaModels: ["ProgramInfo"],
};
