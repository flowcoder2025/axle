import type { ModuleConfig } from "@axle/core-module-system";

export const certsModule: ModuleConfig = {
  id: "certs",
  packId: "G",
  label: "공동인증서",
  icon: "ShieldCheck",
  route: "/certs",
  permission: "certs:read",
  multiOrg: false,
  pbc: [],
  deps: {},
  prismaModels: ["Certificate", "ClientCertificate"],
  requiresDesktop: true,
};
