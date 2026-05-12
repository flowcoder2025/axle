import type { ModuleConfig } from "@axle/core-module-system";

export const hwpxAdminModule: ModuleConfig = {
  id: "hwpx-admin",
  packId: "B",
  label: "HWPX 양식",
  icon: "FileType",
  route: "/platform-admin/hwpx-templates",
  permission: "platform:admin",
  multiOrg: false,
  pbc: [],
  deps: { soft: ["documents"] },
  prismaModels: ["HwpxTemplate"],
  admin: true,
};
