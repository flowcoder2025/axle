import type { ModuleConfig } from "@axle/core-module-system";
import { builderModule } from "./builder/module.config";
import { createModule } from "./create/module.config";
import { packE } from "./pack.config";
import { presetsModule } from "./presets/module.config";
import { workflowsModule } from "./workflows/module.config";

export { packE };
export { builderModule, createModule, presetsModule, workflowsModule };

export const packEModules: ModuleConfig[] = [
  createModule,
  builderModule,
  presetsModule,
  workflowsModule,
];
