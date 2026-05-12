import type { ModuleConfig } from "@axle/core-module-system";

export const attendanceModule: ModuleConfig = {
  id: "attendance",
  packId: "D",
  label: "근태",
  icon: "Clock",
  route: "/attendance",
  permission: "hr:read",
  multiOrg: true,
  pbc: ["hr-payroll"],
  deps: { hard: ["employees"] },
  prismaModels: ["Attendance"],
};
