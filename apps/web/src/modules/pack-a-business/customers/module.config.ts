import type { ModuleConfig } from "@axle/core-module-system";

export const customersModule: ModuleConfig = {
  id: "customers",
  packId: "A",
  label: "고객/거래처",
  icon: "Users",
  route: "/clients",
  permission: "customers:read",
  multiOrg: false,
  pbc: [],
  deps: {},
  prismaModels: ["Client", "Contact", "ClientFinancial", "ClientAchievement"],
};
