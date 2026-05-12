import type { ModuleConfig } from "@axle/core-module-system";

export const createModule: ModuleConfig = {
  id: "create",
  packId: "E",
  label: "이미지 생성",
  icon: "ImagePlus",
  route: "/create",
  permission: "content:read",
  multiOrg: false,
  pbc: ["image-engine"],
  deps: {},
  prismaModels: ["AiJob"],
};
