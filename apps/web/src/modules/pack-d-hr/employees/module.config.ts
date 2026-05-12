import type { ModuleConfig } from "@axle/core-module-system";

export const employeesModule: ModuleConfig = {
  id: "employees",
  packId: "D",
  label: "직원",
  icon: "Users",
  route: "/settings/team",
  permission: "hr:read",
  multiOrg: true,
  pbc: ["hr-payroll"],
  deps: {},
  prismaModels: ["Employment", "WorkSchedule"],
};
