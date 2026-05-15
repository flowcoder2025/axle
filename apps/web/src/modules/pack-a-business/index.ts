import type { ModuleConfig } from "@axle/core-module-system";
import { analyticsModule } from "./analytics/module.config";
import { calendarModule } from "./calendar/module.config";
import { contractsModule } from "./contracts/module.config";
import { customersModule } from "./customers/module.config";
import { documentsModule } from "./documents/module.config";
import { estimatesModule } from "./estimates/module.config";
import { financeModule } from "./finance/module.config";
import { meetingsModule } from "./meetings/module.config";
import { packA } from "./pack.config";
import { portalAdminModule } from "./portal-admin/module.config";
import { projectsModule } from "./projects/module.config";

export { packA };
export {
  analyticsModule,
  calendarModule,
  contractsModule,
  customersModule,
  documentsModule,
  estimatesModule,
  financeModule,
  meetingsModule,
  portalAdminModule,
  projectsModule,
};

export const packAModules: ModuleConfig[] = [
  customersModule,
  projectsModule,
  estimatesModule,
  contractsModule,
  documentsModule,
  portalAdminModule,
  calendarModule,
  meetingsModule,
  financeModule,
  analyticsModule,
];
