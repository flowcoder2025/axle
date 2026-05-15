import type { ModuleConfig } from "@axle/core-module-system";

export const productsModule: ModuleConfig = {
  id: "products",
  packId: "F",
  label: "상품",
  icon: "Package",
  route: "/erp/products",
  permission: "erp:read",
  multiOrg: true,
  pbc: [],
  deps: {},
  prismaModels: ["Product"],
};
