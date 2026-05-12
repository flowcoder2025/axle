import type { ModuleConfig } from "@axle/core-module-system";
import { builderModule } from "./builder/module.config.js";
import { createModule } from "./create/module.config.js";
import { packE } from "./pack.config.js";
import { presetsModule } from "./presets/module.config.js";
import { workflowsModule } from "./workflows/module.config.js";

export { packE };
export { builderModule, createModule, presetsModule, workflowsModule };

export const packEModules: ModuleConfig[] = [
  createModule,
  builderModule,
  presetsModule,
  workflowsModule,
];
