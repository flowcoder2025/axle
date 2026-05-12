import type { ModuleConfig } from "@axle/core-module-system";

export const projectsModule: ModuleConfig = {
  id: "projects",
  packId: "A",
  label: "프로젝트",
  icon: "FolderKanban",
  route: "/projects",
  permission: "projects:read",
  multiOrg: false,
  pbc: [],
  deps: { soft: ["customers"] },
  prismaModels: ["Project", "ProjectMember", "ProjectComment"],
};
