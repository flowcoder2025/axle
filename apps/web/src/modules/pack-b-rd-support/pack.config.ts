import type { PackConfig } from "@axle/core-module-system";

export const packB: PackConfig = {
  id: "B",
  label: "Pack B. 정부 지원사업",
  icon: "🏛️",
  modules: [
    "programs",
    "matching",
    "journals",
    "hwpx-admin",
    "checklist-admin",
    "ai-patterns-admin",
  ],
  pricing: { monthly: 39_000 },
};
