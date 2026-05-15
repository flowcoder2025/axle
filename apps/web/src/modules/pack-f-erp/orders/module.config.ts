import type { ModuleConfig } from "@axle/core-module-system";

export const ordersModule: ModuleConfig = {
  id: "orders",
  packId: "F",
  label: "주문",
  icon: "ShoppingCart",
  route: "/erp/orders",
  permission: "erp:read",
  multiOrg: true,
  pbc: [],
  deps: { hard: ["products"] },
  prismaModels: ["Order", "OrderItem"],
};
