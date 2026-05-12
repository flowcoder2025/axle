import type { ModuleConfig } from "@axle/core-module-system";

export const portalAdminModule: ModuleConfig = {
  id: "portal-admin",
  packId: "A",
  label: "외부 포털",
  icon: "Globe",
  route: "/settings/integrations",
  permission: "portal:read",
  multiOrg: false,
  pbc: [],
  deps: { soft: ["customers", "documents"] },
  prismaModels: ["PortalToken", "ClientPortalAccount", "PortalJournal"],
};
