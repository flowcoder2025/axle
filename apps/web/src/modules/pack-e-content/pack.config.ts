import type { PackConfig } from "@axle/core-module-system";

export const packE: PackConfig = {
  id: "E",
  label: "Pack E. 콘텐츠",
  icon: "🎨",
  modules: ["create", "builder", "presets", "workflows"],
  pricing: { monthly: 59_000, perUnit: 100 },
};
