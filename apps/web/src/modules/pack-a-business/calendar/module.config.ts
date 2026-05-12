import type { ModuleConfig } from "@axle/core-module-system";

export const calendarModule: ModuleConfig = {
  id: "calendar",
  packId: "A",
  label: "일정",
  icon: "Calendar",
  route: "/calendar",
  permission: "calendar:read",
  multiOrg: false,
  pbc: [],
  deps: {},
  prismaModels: ["Schedule"],
};
