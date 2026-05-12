import type { ModuleConfig } from "@axle/core-module-system";
import { automationModule } from "./automation/module.config.js";
import { certsModule } from "./certs/module.config.js";
import { packG } from "./pack.config.js";
import { recordingModule } from "./recording/module.config.js";

export { packG };
export { automationModule, certsModule, recordingModule };

export const packGModules: ModuleConfig[] = [
  automationModule,
  certsModule,
  recordingModule,
];
