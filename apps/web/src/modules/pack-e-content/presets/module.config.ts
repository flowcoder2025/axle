import type { ModuleConfig } from "@axle/core-module-system";

export const presetsModule: ModuleConfig = {
  id: "presets",
  packId: "E",
  label: "프리셋",
  icon: "Wand2",
  route: "/presets",
  permission: "content:read",
  multiOrg: false,
  pbc: ["image-engine"],
  deps: { hard: ["create"] },
  prismaModels: [],
};
