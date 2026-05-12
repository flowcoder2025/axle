import type { ModuleConfig } from "@axle/core-module-system";

export const automationModule: ModuleConfig = {
  id: "automation",
  packId: "G",
  label: "포털 자동화",
  icon: "Bot",
  route: "/automation",
  permission: "automation:read",
  multiOrg: false,
  pbc: ["crawler"],
  deps: {},
  prismaModels: ["ScraperJob", "ScraperApiKey", "AutomationLog", "ScraperRepairLog"],
  requiresDesktop: true,
};
