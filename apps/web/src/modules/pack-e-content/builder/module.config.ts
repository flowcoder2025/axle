import type { ModuleConfig } from "@axle/core-module-system";

export const builderModule: ModuleConfig = {
  id: "builder",
  packId: "E",
  label: "빌더",
  icon: "LayoutTemplate",
  route: "/builder",
  permission: "content:read",
  multiOrg: false,
  pbc: ["block-builder"],
  deps: {},
  prismaModels: [],
};
