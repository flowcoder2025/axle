import type { ModuleConfig } from "@axle/core-module-system";

export const journalsModule: ModuleConfig = {
  id: "journals",
  packId: "B",
  label: "연구일지",
  icon: "BookOpen",
  route: "/journals",
  permission: "journals:read",
  multiOrg: true,
  pbc: ["ai"],
  deps: { soft: ["projects", "documents"] },
  prismaModels: ["ResearchJournal"],
};
