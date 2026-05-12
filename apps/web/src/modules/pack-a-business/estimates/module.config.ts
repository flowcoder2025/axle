import type { ModuleConfig } from "@axle/core-module-system";

export const estimatesModule: ModuleConfig = {
  id: "estimates",
  packId: "A",
  label: "견적",
  icon: "FileSpreadsheet",
  route: "/estimates",
  permission: "estimates:read",
  multiOrg: false,
  pbc: [],
  deps: { soft: ["customers", "projects"] },
  prismaModels: ["Estimate"],
};
