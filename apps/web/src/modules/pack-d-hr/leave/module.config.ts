import type { ModuleConfig } from "@axle/core-module-system";

export const leaveModule: ModuleConfig = {
  id: "leave",
  packId: "D",
  label: "연차",
  icon: "CalendarOff",
  route: "/leave",
  permission: "hr:read",
  multiOrg: true,
  pbc: ["hr-payroll"],
  deps: { hard: ["employees"] },
  prismaModels: ["Leave"],
};
