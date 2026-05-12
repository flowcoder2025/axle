import type { ModuleConfig } from "@axle/core-module-system";
import { attendanceModule } from "./attendance/module.config.js";
import { employeesModule } from "./employees/module.config.js";
import { leaveModule } from "./leave/module.config.js";
import { nomuModule } from "./nomu/module.config.js";
import { packD } from "./pack.config.js";
import { payrollModule } from "./payroll/module.config.js";

export { packD };
export {
  attendanceModule,
  employeesModule,
  leaveModule,
  nomuModule,
  payrollModule,
};

export const packDModules: ModuleConfig[] = [
  employeesModule,
  payrollModule,
  attendanceModule,
  leaveModule,
  nomuModule,
];
