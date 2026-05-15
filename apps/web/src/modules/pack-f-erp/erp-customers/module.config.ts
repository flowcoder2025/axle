import type { ModuleConfig } from "@axle/core-module-system";

export const erpCustomersModule: ModuleConfig = {
  id: "erp-customers",
  packId: "F",
  label: "거래처",
  icon: "Building2",
  route: "/erp/counterparties",
  permission: "erp:read",
  multiOrg: true,
  pbc: [],
  deps: {},
  prismaModels: [],
};
