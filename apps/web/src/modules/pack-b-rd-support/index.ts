import type { ModuleConfig } from "@axle/core-module-system";
import { aiPatternsAdminModule } from "./ai-patterns-admin/module.config";
import { checklistAdminModule } from "./checklist-admin/module.config";
import { hwpxAdminModule } from "./hwpx-admin/module.config";
import { journalsModule } from "./journals/module.config";
import { matchingModule } from "./matching/module.config";
import { packB } from "./pack.config";
import { programsModule } from "./programs/module.config";

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
