import type { ModuleConfig } from "@axle/core-module-system";

export const erpReportsModule: ModuleConfig = {
  id: "erp-reports",
  packId: "F",
  label: "리포트",
  icon: "BarChart3",
  route: "/erp/reports",
  permission: "erp:read",
  multiOrg: true,
  pbc: [],
  deps: {},
  prismaModels: [],
};
