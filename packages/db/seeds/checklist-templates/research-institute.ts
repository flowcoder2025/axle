/**
 * Platform-wide RESEARCH_INSTITUTE checklist templates (WI-309).
 *
 * Seeds the canonical 기업부설연구소(전담부서) 인정 신청 체크리스트 so every
 * RESEARCH_INSTITUTE project starts with the agency-expected document set.
 *
 * KOITA(한국산업기술진흥협회) 인정 요건:
 *   1. 연구전담요원 자격 (학위/자격증/경력) + 4대 보험 가입
 *   2. 독립된 연구공간 (벽체·칸막이로 구분)
 *   3. 보유 기자재·장비
 *   4. 연구개발 활동 계획 + 신청서
 *
 * Items are split into 3 phases — same shape as `patent.ts` / `venture.ts`:
 *
 *   1. 연구원 자격 증빙        (researcher qualification evidence)
 *   2. 연구공간·기자재 증빙    (lab space + equipment evidence)
 *   3. 신청 서류 + 인정서      (application docs + final certificate)
 *
 * Seed is idempotent — re-running does not duplicate templates. Scope is
 * platform-wide (`orgId = null`).
 */

import type { PrismaClient } from "@prisma/client";

export interface ResearchInstituteTemplateItem {
  name: string;
  description: string;
  isRequired: boolean;
  itemType: "DOCUMENT" | "CERTIFICATE";
  certificateType?: string;
}

export interface ResearchInstituteTemplateDef {
  name: string;
  description: string;
  isRequired: boolean;
  items: ResearchInstituteTemplateItem[];
}

/**
 * Canonical list — 12 items across 3 phases. Order mirrors KOITA application
 * workflow; `sortOrder` derived from array index.
 */
export const RESEARCH_INSTITUTE_CHECKLIST_TEMPLATES: readonly ResearchInstituteTemplateDef[] = [
  {
    name: "① 연구원 자격 증빙",
    description:
      "연구전담요원 인정 요건(자연계열 학위 또는 기능사·산업기사+경력)을 충족함을 입증하는 서류 + 4대 보험 가입 증명.",
    isRequired: true,
    items: [
      {
        name: "연구전담요원 학위·졸업증명서",
        description:
          "전담요원 전원의 최종 학위증·졸업증명서. KOITA 인정 자연·공학계열 + 학사 이상 요건과 대조.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
      {
        name: "연구전담요원 자격증 사본",
        description:
          "기능사·산업기사 자격으로 인정받는 연구원에 한해 필수. 자격증과 동일 직종 4년 이상 경력 증빙과 함께 제출.",
        isRequired: false,
        itemType: "DOCUMENT",
      },
      {
        name: "연구전담요원 경력증명서",
        description:
          "학력 외 경력으로 자격을 갖추는 연구원에 한해 필수. 동일 직종 근무 기간이 명시되어야 함.",
        isRequired: false,
        itemType: "DOCUMENT",
      },
      {
        name: "4대 보험 가입자 명부",
        description:
          "신청월 기준 가장 최근 월의 가입자 명부. 연구전담요원이 신청 기업에 4대 보험 피보험자로 등록되어 있어야 함.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
      {
        name: "연구전담요원 재직증명서",
        description:
          "전담요원 전원의 재직증명서. 입사일·직위·담당업무가 표기되어야 하며, 4대 보험 가입자 명부와 교차 확인됨.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
    ],
  },
  {
    name: "② 연구공간·기자재 증빙",
    description:
      "독립된 연구공간(벽체·칸막이·고정 출입문)과 보유 기자재를 입증하는 서류. KOITA 실태조사 대비.",
    isRequired: true,
    items: [
      {
        name: "사업자등록증",
        description:
          "최신 발급본 또는 사업자등록증명원. 신청일 기준 3개월 이내 발급분 권장. 사업장 주소가 연구공간 주소와 일치해야 함.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
      {
        name: "연구공간 평면도/도면",
        description:
          "연구공간이 벽체·칸막이로 다른 부서와 구분되어 있음을 확인할 수 있는 도면. 면적·출입문 위치 표시.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
      {
        name: "연구공간 사진",
        description:
          "출입문, 내부 전경, 책상·장비 배치를 다각도로 촬영한 사진. 연구소·전담부서 표지판이 보이도록 촬영 권장.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
      {
        name: "보유 기자재·장비 명세서",
        description:
          "연구활동에 사용되는 기자재·장비 목록 (품명/규격/취득일/취득가액). 사진 또는 자산관리대장과 함께 제출.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
    ],
  },
  {
    name: "③ 신청 서류 + 인정서",
    description:
      "KOITA 신고 양식과 연구개발 활동 계획서, 그리고 최종 발급되는 기업부설연구소 인정서.",
    isRequired: true,
    items: [
      {
        name: "연구개발 활동 계획서",
        description:
          "향후 1년간 추진할 연구과제·인력 운용·예산 계획을 정리. WI-311 KOITA 신고서 generator로 자동 생성 가능.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
      {
        name: "기업부설연구소·전담부서 인정신청서",
        description:
          "한국산업기술진흥협회(KOITA) 신고 시스템(rnd.or.kr) 신청 양식. 신청 유형(연구소/전담부서) 명시.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
      {
        name: "기업부설연구소 인정서",
        description:
          "KOITA 인정 후 발급. 등록 시 WI-325로 Certificate 레코드 자동 생성과 연동되며, 만료가 없는 인증으로 갱신 cron(WI-326) 대상에서 제외됩니다.",
        isRequired: true,
        itemType: "CERTIFICATE",
        certificateType: "기업부설연구소 인정서",
      },
    ],
  },
] as const;

/**
 * Idempotent seeder — platform-wide (orgId=null). Mirrors patent/venture:
 *   - Existing template by (orgId=null, projectType=RESEARCH_INSTITUTE, name) is reused
 *   - Items are matched by template + name; missing ones are created
 */
export async function seedResearchInstituteChecklistTemplates(
  prisma: PrismaClient,
): Promise<{ templatesUpserted: number; itemsUpserted: number }> {
  let templatesUpserted = 0;
  let itemsUpserted = 0;

  for (let i = 0; i < RESEARCH_INSTITUTE_CHECKLIST_TEMPLATES.length; i += 1) {
    const def = RESEARCH_INSTITUTE_CHECKLIST_TEMPLATES[i];

    const existing = await prisma.checklistTemplate.findFirst({
      where: { orgId: null, projectType: "RESEARCH_INSTITUTE", name: def.name },
      select: { id: true },
    });

    const template = existing
      ? await prisma.checklistTemplate.update({
          where: { id: existing.id },
          data: {
            description: def.description,
            isRequired: def.isRequired,
            sortOrder: i,
          },
          select: { id: true },
        })
      : await prisma.checklistTemplate.create({
          data: {
            orgId: null,
            projectType: "RESEARCH_INSTITUTE",
            name: def.name,
            description: def.description,
            isRequired: def.isRequired,
            sortOrder: i,
          },
          select: { id: true },
        });

    if (!existing) templatesUpserted += 1;

    for (let j = 0; j < def.items.length; j += 1) {
      const itemDef = def.items[j];
      const existingItem = await prisma.checklistTemplateItem.findFirst({
        where: { templateId: template.id, name: itemDef.name },
        select: { id: true },
      });
      if (existingItem) {
        await prisma.checklistTemplateItem.update({
          where: { id: existingItem.id },
          data: {
            description: itemDef.description,
            isRequired: itemDef.isRequired,
            itemType: itemDef.itemType,
            certificateType: itemDef.certificateType ?? null,
            sortOrder: j,
          },
        });
      } else {
        await prisma.checklistTemplateItem.create({
          data: {
            templateId: template.id,
            name: itemDef.name,
            description: itemDef.description,
            isRequired: itemDef.isRequired,
            itemType: itemDef.itemType,
            certificateType: itemDef.certificateType ?? null,
            sortOrder: j,
          },
        });
        itemsUpserted += 1;
      }
    }
  }

  return { templatesUpserted, itemsUpserted };
}
