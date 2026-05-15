import type { ModuleConfig } from "@axle/core-module-system";
import { automationModule } from "./automation/module.config";
import { certsModule } from "./certs/module.config";
import { packG } from "./pack.config";
import { recordingModule } from "./recording/module.config";

export { packG };
export { automationModule, certsModule, recordingModule };

export const packGModules: ModuleConfig[] = [
  automationModule,
  certsModule,
  recordingModule,
];
