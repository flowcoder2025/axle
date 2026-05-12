import type { ModuleConfig } from "@axle/core-module-system";

export const payrollModule: ModuleConfig = {
  id: "payroll",
  packId: "D",
  label: "급여",
  icon: "Banknote",
  route: "/payroll",
  permission: "hr:read",
  multiOrg: true,
  pbc: ["hr-payroll"],
  deps: { hard: ["employees"] },
  prismaModels: ["Payroll", "PayrollItem"],
};
