import type { PackConfig } from "@axle/core-module-system";

export const packF: PackConfig = {
  id: "F",
  label: "Pack F. ERP",
  icon: "📦",
  modules: [
    "products",
    "inventory",
    "orders",
    "intake",
    "erp-customers",
    "shipping",
    "purchase",
    "erp-reports",
  ],
  pricing: { monthly: 89_000 },
};
