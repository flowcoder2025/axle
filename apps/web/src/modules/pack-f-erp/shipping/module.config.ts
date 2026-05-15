import type { ModuleConfig } from "@axle/core-module-system";

export const shippingModule: ModuleConfig = {
  id: "shipping",
  packId: "F",
  label: "배송",
  icon: "Truck",
  route: "/erp/shipping",
  permission: "erp:read",
  multiOrg: true,
  pbc: [],
  deps: { hard: ["orders"] },
  prismaModels: [],
};
