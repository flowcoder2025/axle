import type { PackConfig } from "@axle/core-module-system";

export const packD: PackConfig = {
  id: "D",
  label: "Pack D. HR",
  icon: "👥",
  modules: ["employees", "payroll", "attendance", "leave", "nomu"],
  pricing: { monthly: 49_000, perUnit: 1_000 },
};
