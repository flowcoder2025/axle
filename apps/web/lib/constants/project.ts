import type { ProjectType } from "@prisma/client";

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  BUSINESS_PLAN: "사업계획서",
  VENTURE_CERT: "벤처인증",
  SOBOOJANG_CERT: "소부장인증",
  RESEARCH_INSTITUTE: "연구소설립",
  PATENT: "특허",
  FINANCIAL_ANALYSIS: "재무분석",
  RESEARCH_TASK: "연구과제",
  BUNDLE: "통합패키지",
};
