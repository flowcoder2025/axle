import type { ModuleConfig } from "@axle/core-module-system";

export const matchingModule: ModuleConfig = {
  id: "matching",
  packId: "B",
  label: "AI 매칭",
  icon: "Sparkles",
  route: "/matching",
  permission: "matching:read",
  multiOrg: true,
  pbc: ["matching", "ai"],
  deps: { hard: ["programs"], soft: ["customers"] },
  prismaModels: ["MatchingResult"],
};
