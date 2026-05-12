import type { ModuleConfig } from "@axle/core-module-system";

export const checklistAdminModule: ModuleConfig = {
  id: "checklist-admin",
  packId: "B",
  label: "체크리스트",
  icon: "ListChecks",
  route: "/platform-admin/checklist-templates",
  permission: "platform:admin",
  multiOrg: false,
  pbc: [],
  deps: { hard: ["programs"] },
  prismaModels: ["ChecklistTemplate", "ChecklistTemplateItem"],
  admin: true,
};
