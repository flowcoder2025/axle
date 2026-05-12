import type { ModuleConfig } from "@axle/core-module-system";

export const aiPatternsAdminModule: ModuleConfig = {
  id: "ai-patterns-admin",
  packId: "B",
  label: "AI 패턴",
  icon: "Brain",
  route: "/platform-admin/ai-patterns",
  permission: "platform:admin",
  multiOrg: false,
  pbc: ["ai"],
  deps: { hard: ["matching"] },
  prismaModels: ["SkillPattern"],
  admin: true,
};
