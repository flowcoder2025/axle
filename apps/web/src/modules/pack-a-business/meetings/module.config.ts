import type { ModuleConfig } from "@axle/core-module-system";

export const meetingsModule: ModuleConfig = {
  id: "meetings",
  packId: "A",
  label: "미팅",
  icon: "Video",
  route: "/meetings",
  permission: "meetings:read",
  multiOrg: false,
  pbc: ["ai"],
  deps: { soft: ["customers", "projects", "calendar"] },
  prismaModels: ["Meeting", "MeetingAttendee", "MeetingTranscript", "ActionItem"],
};
