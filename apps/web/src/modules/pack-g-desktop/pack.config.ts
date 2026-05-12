import type { PackConfig } from "@axle/core-module-system";

export const packG: PackConfig = {
  id: "G",
  label: "Add-on G. Desktop",
  icon: "🖥️",
  modules: ["automation", "certs", "recording"],
  pricing: { monthly: 29_000 },
};
