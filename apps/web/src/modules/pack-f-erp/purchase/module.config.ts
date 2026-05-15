import type { ModuleConfig } from "@axle/core-module-system";

export const purchaseModule: ModuleConfig = {
  id: "purchase",
  packId: "F",
  label: "발주",
  icon: "ClipboardList",
  route: "/erp/purchase",
  permission: "erp:read",
  multiOrg: true,
  pbc: [],
  deps: { hard: ["products"] },
  prismaModels: [],
};
