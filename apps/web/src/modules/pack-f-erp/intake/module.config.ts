import type { ModuleConfig } from "@axle/core-module-system";

export const intakeModule: ModuleConfig = {
  id: "intake",
  packId: "F",
  label: "영수증 등록",
  icon: "ScanLine",
  route: "/erp/intake",
  permission: "erp:write",
  multiOrg: true,
  pbc: [],
  deps: { hard: ["products", "orders"] },
  prismaModels: ["IntakeDraft"],
};
