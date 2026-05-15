import type { ModuleConfig } from "@axle/core-module-system";

export const inventoryModule: ModuleConfig = {
  id: "inventory",
  packId: "F",
  label: "재고",
  icon: "Boxes",
  route: "/erp/inventory",
  permission: "erp:read",
  multiOrg: true,
  pbc: [],
  deps: { hard: ["products"] },
  prismaModels: ["InventoryMovement"],
};
