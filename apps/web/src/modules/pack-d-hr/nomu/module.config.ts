import type { ModuleConfig } from "@axle/core-module-system";

export const nomuModule: ModuleConfig = {
  id: "nomu",
  packId: "D",
  label: "노무",
  icon: "Scale",
  route: "/nomu",
  permission: "hr:read",
  multiOrg: true,
  pbc: ["hr-payroll", "ai"],
  deps: {},
  prismaModels: ["NomuConsultation"],
};
