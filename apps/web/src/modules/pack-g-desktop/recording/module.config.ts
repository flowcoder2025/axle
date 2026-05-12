import type { ModuleConfig } from "@axle/core-module-system";

export const recordingModule: ModuleConfig = {
  id: "recording",
  packId: "G",
  label: "녹취",
  icon: "Mic",
  route: "/recording",
  permission: "recording:read",
  multiOrg: false,
  pbc: ["ai"],
  deps: { soft: ["meetings"] },
  prismaModels: ["MeetingTranscript"],
  requiresDesktop: true,
};
