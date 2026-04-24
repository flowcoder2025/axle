/**
 * Platform-wide VENTURE_CERT checklist templates (WI-304).
 *
 * Seeds the canonical 벤처기업(연구개발유형) 확인 신청 체크리스트 so every
 * VENTURE_CERT project starts with the agency-expected document set.
 *
 * 연구개발유형 확인 요건 — 「벤처기업육성에 관한 특별법」 시행령 별표:
 *   1. 기업부설연구소/전담부서 보유
 *   2. 직전 4분기 연구개발비 5천만원 이상
 *   3. 연 매출액 대비 연구개발비 비율 5% 이상 (창업 3년 미만은 면제)
 *   4. 사업의 성장성 평가 통과 (기술성평가서)
 *
 * Items are split into 3 phases — same shape as `patent.ts` so the UI
 * renders consistently:
 *
 *   1. 기업 기본 서류            (corporate basics)
 *   2. 연구개발·인력 증빙        (R&D and headcount evidence)
 *   3. 신청 서류 + 확인서        (application docs + final certificate)
 *
 * Seed is idempotent — re-running does not duplicate templates. Scope is
 * platform-wide (`orgId = null`).
 */

import type { PrismaClient } from "@prisma/client";
import {
  seedChecklistTemplates,
  type ChecklistSeedResult,
  type ChecklistTemplateDef,
  type ChecklistTemplateItemDef,
} from "./_shared.js";

// Back-compat re-exports — existing tests import these names.
export type VentureTemplateItem = ChecklistTemplateItemDef;
export type VentureTemplateDef = ChecklistTemplateDef;

/**
 * Canonical list — 12 items across 3 phases. Order matches the real
 * workflow; `sortOrder` is derived from array index.
 */
export const VENTURE_CHECKLIST_TEMPLATES: readonly VentureTemplateDef[] = [
  {
    name: "① 기업 기본 서류",
    description:
      "벤처확인기관(중기부 지정 평가기관)이 기업 실체와 인력 규모를 확인하는 데 사용하는 기초 서류.",
    isRequired: true,
    items: [
      {
        name: "사업자등록증",
        description:
          "최신 발급본 또는 사업자등록증명원. 신청일 기준 3개월 이내 발급분 권장.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
      {
        name: "법인등기부등본",
        description:
          "법인 사업자에 한해 필수. 신청일 기준 3개월 이내 발급분. 자본금·임원 변동 사항 반영본.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
      {
        name: "4대 보험 가입자 명부",
        description:
          "신청월 기준 가장 최근 월의 가입자 명부. 연구원·일반직 인원 수 산정 근거가 됩니다.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
    ],
  },
  {
    name: "② 연구개발·인력 증빙",
    description:
      "연구개발유형 핵심 요건(연구소 보유/연구개발비 5천만원/매출 대비 5%)을 입증하는 서류.",
    isRequired: true,
    items: [
      {
        name: "기업부설연구소·전담부서 인정서",
        description:
          "한국산업기술진흥협회(KOITA) 발급. 인정일이 신청일 이전이어야 하며, 갱신/변경 이력이 있다면 최신본 첨부.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
      {
        name: "연구전담요원 학력증명서",
        description:
          "연구원 전원의 학위증·졸업증명서. KOITA 인정 요건(전문학사 이상 + 자연·공학계열 등)에 부합해야 함.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
      {
        name: "연구전담요원 재직증명서",
        description:
          "연구원이 4대 보험에 가입된 상태로 회사에 소속되어 있음을 입증. 4대 보험 가입자 명부와 교차 확인됨.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
      {
        name: "연구개발비 집행 내역",
        description:
          "회계장부/ERP 출력본 또는 별도 R&D 비용 집계표. 인건비·재료비·외주비 등 항목별 분리. 직전 4분기 누계 5천만원 이상이어야 함.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
      {
        name: "매출액 대비 연구개발비 비율 산정표",
        description:
          "직전 사업연도 매출액과 연구개발비를 대조해 5% 이상임을 산정. 창업 3년 미만 기업은 면제이나 자료는 첨부 권장.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
    ],
  },
  {
    name: "③ 신청 서류 + 확인서",
    description:
      "벤처확인 신청서 + 평가에 사용되는 사업계획서/기술성평가서, 그리고 최종 발급되는 벤처기업확인서.",
    isRequired: true,
    items: [
      {
        name: "최근 3년 재무제표",
        description:
          "표준재무제표증명원(국세청) 또는 외부감사보고서. 매출·연구개발비·자본금 산정 근거.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
      {
        name: "벤처확인용 사업계획서",
        description:
          "중기부 공식 9섹션 양식. WI-301 generator(`@axle/docgen` venture-tech-assessment)로 자동 생성 가능.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
      {
        name: "벤처기업확인 신청서",
        description:
          "중소벤처기업부 벤처확인종합관리시스템(SMTECH/벤처인) 신청 양식. 신청 유형(연구개발/혁신성장/투자) 명시.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
      {
        name: "벤처기업확인서",
        description:
          "최종 발급 확인서. 등록 시 WI-325로 Certificate 레코드 자동 생성과 연동되어 갱신 90일 전 알림(WI-326) 대상이 됩니다.",
        isRequired: true,
        itemType: "CERTIFICATE",
        certificateType: "벤처기업확인서",
      },
    ],
  },
] as const;

/**
 * Idempotent seeder — platform-wide (orgId=null). Delegates to the shared
 * runner; VENTURE_CERT-specific behaviour lives entirely in the data array above.
 */
export async function seedVentureChecklistTemplates(
  prisma: PrismaClient,
): Promise<ChecklistSeedResult> {
  return seedChecklistTemplates(prisma, "VENTURE_CERT", VENTURE_CHECKLIST_TEMPLATES);
}
