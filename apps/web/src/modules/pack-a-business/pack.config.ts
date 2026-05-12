import type { PackConfig } from "@axle/core-module-system";

export const packA: PackConfig = {
  id: "A",
  label: "Pack A. 비즈니스 운영",
  icon: "💼",
  modules: [
    "customers",
    "projects",
    "estimates",
    "contracts",
    "documents",
    "portal-admin",
    "calendar",
    "meetings",
    "finance",
    "analytics",
  ],
  pricing: { monthly: 59_000 },
  recommended: true,
};
