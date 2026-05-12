import type { ModuleConfig } from "@axle/core-module-system";

export const analyticsModule: ModuleConfig = {
  id: "analytics",
  packId: "A",
  label: "분석 리포트",
  icon: "BarChart3",
  route: "/analytics",
  permission: "analytics:read",
  multiOrg: true,
  pbc: [],
  deps: {},
  prismaModels: ["AnalyticsEvent", "DailyMetric", "DailyActionMetric"],
};
