import type { ModuleConfig } from "@axle/core-module-system";
import { attendanceModule } from "./attendance/module.config";
import { employeesModule } from "./employees/module.config";
import { leaveModule } from "./leave/module.config";
import { nomuModule } from "./nomu/module.config";
import { packD } from "./pack.config";
import { payrollModule } from "./payroll/module.config";

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
