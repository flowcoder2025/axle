import type { ModuleConfig } from "@axle/core-module-system";
import { aiPatternsAdminModule } from "./ai-patterns-admin/module.config.js";
import { checklistAdminModule } from "./checklist-admin/module.config.js";
import { hwpxAdminModule } from "./hwpx-admin/module.config.js";
import { journalsModule } from "./journals/module.config.js";
import { matchingModule } from "./matching/module.config.js";
import { packB } from "./pack.config.js";
import { programsModule } from "./programs/module.config.js";

export { packB };
export {
  aiPatternsAdminModule,
  checklistAdminModule,
  hwpxAdminModule,
  journalsModule,
  matchingModule,
  programsModule,
};

export const packBModules: ModuleConfig[] = [
  programsModule,
  matchingModule,
  journalsModule,
  hwpxAdminModule,
  checklistAdminModule,
  aiPatternsAdminModule,
];
