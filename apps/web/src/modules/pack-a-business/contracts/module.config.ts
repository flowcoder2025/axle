import type { ModuleConfig } from "@axle/core-module-system";

export const contractsModule: ModuleConfig = {
  id: "contracts",
  packId: "A",
  label: "계약",
  icon: "FileSignature",
  route: "/contracts",
  permission: "contracts:read",
  multiOrg: false,
  pbc: [],
  deps: { soft: ["customers", "projects", "estimates"] },
  prismaModels: ["Contract"],
};
