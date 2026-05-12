import type { ModuleConfig } from "@axle/core-module-system";

export const workflowsModule: ModuleConfig = {
  id: "workflows",
  packId: "E",
  label: "ComfyUI",
  icon: "Workflow",
  route: "/workflows",
  permission: "platform:admin",
  multiOrg: false,
  pbc: ["image-engine"],
  deps: { hard: ["create"] },
  prismaModels: [],
  admin: true,
};
