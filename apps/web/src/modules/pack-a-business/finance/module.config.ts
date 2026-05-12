import type { ModuleConfig } from "@axle/core-module-system";

export const financeModule: ModuleConfig = {
  id: "finance",
  packId: "A",
  label: "재무",
  icon: "Wallet",
  route: "/finance",
  permission: "finance:read",
  multiOrg: true,
  pbc: [],
  deps: { soft: ["customers", "contracts"] },
  prismaModels: ["FinancialReport", "ClientFinancial"],
};
