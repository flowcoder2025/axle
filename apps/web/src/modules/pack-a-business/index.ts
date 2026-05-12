import type { ModuleConfig } from "@axle/core-module-system";
import { analyticsModule } from "./analytics/module.config.js";
import { calendarModule } from "./calendar/module.config.js";
import { contractsModule } from "./contracts/module.config.js";
import { customersModule } from "./customers/module.config.js";
import { documentsModule } from "./documents/module.config.js";
import { estimatesModule } from "./estimates/module.config.js";
import { financeModule } from "./finance/module.config.js";
import { meetingsModule } from "./meetings/module.config.js";
import { packA } from "./pack.config.js";
import { portalAdminModule } from "./portal-admin/module.config.js";
import { projectsModule } from "./projects/module.config.js";

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
