import type { ModuleConfig } from "@axle/core-module-system";

export const documentsModule: ModuleConfig = {
  id: "documents",
  packId: "A",
  label: "서류 + OCR",
  icon: "Files",
  route: "/documents",
  permission: "documents:read",
  multiOrg: false,
  pbc: ["ai"],
  deps: {},
  prismaModels: ["Document", "DocumentEmbedding"],
};
