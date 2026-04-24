/**
 * Platform-wide PATENT checklist templates (WI-315).
 *
 * Seeds the canonical 발명신고서 / 직무발명 / 특허 출원 체크리스트 so every
 * PATENT project created in a new organization starts with the agency-expected
 * document set. Items are split into three phases:
 *
 *   1. 발명 신고        (invention disclosure)
 *   2. 출원 준비         (application preparation)
 *   3. 등록 후           (post-registration)
 *
 * The seed is idempotent — re-running it does not duplicate templates. Scope
 * is platform-wide (`orgId = null`); organizations that need custom items
 * can clone and extend through the existing ChecklistTemplate Admin UI.
 */

import type { PrismaClient } from "@prisma/client";

export interface PatentTemplateItem {
  name: string;
  description: string;
  isRequired: boolean;
  itemType: "DOCUMENT" | "CERTIFICATE";
  certificateType?: string;
}

export interface PatentTemplateDef {
  name: string;
  description: string;
  isRequired: boolean;
  items: PatentTemplateItem[];
}

/**
 * Canonical list. Keep this ordered by the real workflow — `sortOrder` is
 * derived from array index so reordering here reorders the UI.
 */
export const PATENT_CHECKLIST_TEMPLATES: readonly PatentTemplateDef[] = [
  {
    name: "① 발명 신고",
    description:
      "발명 신고 단계에서 필요한 기본 서류. 직무발명 여부를 확정하고 발명자 양도 관계를 명문화합니다.",
    isRequired: true,
    items: [
      {
        name: "발명신고서",
        description:
          "발명자·발명 명칭·기술 요지·해결 과제·기대 효과를 담은 내부 신고서. 기업 표준 양식 또는 특허청 권장 양식 사용.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
      {
        name: "선행기술 조사 보고서",
        description:
          "KIPRIS, Google Patents 등으로 유사 특허·논문을 조사한 결과. 청구항 작성 및 거절이유 대응 근거가 됩니다.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
      {
        name: "직무발명 해당 여부 검토서",
        description:
          "발명이 직무 범위 안에서 이루어졌는지 판정하는 내부 검토서. 「발명진흥법」 제2조 기준으로 작성.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
      {
        name: "직무발명 승계(양도) 동의서",
        description:
          "발명자에서 회사로 특허 받을 권리를 양도한다는 서면 동의. 발명자 전원 서명 필수.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
      {
        name: "발명자 재직증명서",
        description:
          "발명 시점에 발명자가 회사에 소속되어 있었음을 입증. 퇴사자는 재직 당시 기간이 포함되어 있어야 함.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
    ],
  },
  {
    name: "② 출원 준비",
    description:
      "특허 출원을 위한 명세서·도면·청구항 등 핵심 첨부 서류.",
    isRequired: true,
    items: [
      {
        name: "특허 명세서 초안",
        description:
          "기술 분야, 배경기술, 발명의 내용, 실시예까지 포함한 초안. 청구항과의 상호 참조 확인.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
      {
        name: "청구항(Claims) 초안",
        description:
          "독립항·종속항 체계. 범위가 너무 좁거나 넓지 않은지 사내 특허팀 또는 변리사 검토 필수.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
      {
        name: "요약서",
        description: "발명의 핵심 구성을 200~400자 분량으로 정리.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
      {
        name: "도면",
        description:
          "발명을 시각적으로 설명하는 도면 세트. 특허청 도면 규격(A4, 흑백 라인) 준수.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
      {
        name: "특허 출원 위임장",
        description: "변리사에게 출원을 대리시키는 경우에만 필요.",
        isRequired: false,
        itemType: "DOCUMENT",
      },
      {
        name: "우선권 주장 서류",
        description:
          "국내외 선출원을 기초로 우선권을 주장할 때만 필요. 선출원 번호와 출원일을 명시.",
        isRequired: false,
        itemType: "DOCUMENT",
      },
    ],
  },
  {
    name: "③ 등록 후",
    description: "출원 이후 추적·관리 항목. 최종적으로 특허등록증 수령으로 종료됩니다.",
    isRequired: true,
    items: [
      {
        name: "출원번호 수령 확인",
        description: "KIPRIS에서 출원번호 조회 → Project 메타데이터에 기록.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
      {
        name: "심사청구서",
        description:
          "출원일로부터 3년 이내 제출 (2017년 이후 출원). 공제·감면 대상 여부 확인.",
        isRequired: true,
        itemType: "DOCUMENT",
      },
      {
        name: "특허등록증",
        description:
          "등록결정 후 특허등록증 수령 시 업로드. WI-325로 Certificate 레코드 자동 생성과 연동.",
        isRequired: true,
        itemType: "CERTIFICATE",
        certificateType: "특허등록증",
      },
    ],
  },
] as const;

/**
 * Idempotent seeder — platform-wide (orgId=null). Safe to run repeatedly:
 *   - Existing template by (orgId=null, projectType=PATENT, name) is reused
 *   - Items are re-created only when missing (matched by template + name)
 */
export async function seedPatentChecklistTemplates(
  prisma: PrismaClient,
): Promise<{ templatesUpserted: number; itemsUpserted: number }> {
  let templatesUpserted = 0;
  let itemsUpserted = 0;

  for (let i = 0; i < PATENT_CHECKLIST_TEMPLATES.length; i += 1) {
    const def = PATENT_CHECKLIST_TEMPLATES[i];

    const existing = await prisma.checklistTemplate.findFirst({
      where: { orgId: null, projectType: "PATENT", name: def.name },
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
            projectType: "PATENT",
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
