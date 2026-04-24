/**
 * WI-323: BUNDLE 공통 서류 하위 프로젝트 전파.
 *
 * 기업별 자주 쓰이는 공통 서류(사업자등록증, 법인등기부등본, 4대 보험 가입자
 * 명부 등)를 BUNDLE 부모 프로젝트에 1회 업로드하면, 매칭되는 이름을 가진
 * 자식(벤처/연구소/특허) ChecklistItem에 자동으로 연결합니다.
 *
 * 설계 포인트:
 * - **스키마 변경 없음**: `ChecklistItem.documentId` FK를 활용. 동일
 *   Document 레코드를 여러 ChecklistItem이 참조합니다 (파일 복사 없음).
 * - **매칭 기준**: 부모 Document.name vs 자식 ChecklistItem.name
 *   (trim + case-insensitive exact). 퍼지 매칭은 오작동 위험이 커서
 *   일부러 사용하지 않습니다 (사용자 혼란 > 매칭 누락).
 * - **보존 규칙**: 이미 documentId가 있거나 status가 VERIFIED인 자식
 *   ChecklistItem은 건드리지 않습니다. 사람이 검증한 결과를 덮어쓰지
 *   않기 위함.
 * - **status 전이**: 매칭 성공 시 `UPLOADED`로만 설정합니다. 자동
 *   `VERIFIED`는 사람이 내용을 확인해야 하는 원칙을 깨트릴 수 있으므로
 *   의도적으로 피합니다.
 * - **idempotent**: 여러 번 호출해도 동일 결과. 이미 같은 documentId로
 *   연결된 경우는 `alreadyLinked`로 분류.
 */

import type { DocStatus } from "@prisma/client";

/** 이름 정규화 — 전처리 없는 매칭은 공백/대소문자 차이로 대부분 실패한다. */
export function normalizeDocName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * 매칭 판별: 부모 Document와 자식 ChecklistItem이 같은 서류인지.
 * 이름 정규화 결과가 정확히 일치해야 합니다.
 */
export function isMatchingDocName(
  parentDocName: string,
  childItemName: string,
): boolean {
  return normalizeDocName(parentDocName) === normalizeDocName(childItemName);
}

export interface PropagationInputChildItem {
  id: string;
  name: string;
  status: DocStatus;
  documentId: string | null;
}

export interface PropagationInputChild {
  id: string;
  checklistItems: PropagationInputChildItem[];
}

export interface PropagationInputDocument {
  id: string;
  name: string;
}

export interface PropagationPlanUpdate {
  childProjectId: string;
  checklistItemId: string;
  fromDocumentId: string | null;
  toDocumentId: string;
  itemName: string;
}

export interface PropagationPlan {
  updates: PropagationPlanUpdate[];
  skippedBecauseVerified: number;
  skippedBecauseAlreadyLinkedToSame: number;
  skippedBecauseLinkedToOther: number;
  noMatchInChildren: number;
}

/**
 * Pure 계획 산출 함수 — DB에 쓰기 전 어떤 업데이트가 발생할지 계산합니다.
 * 서비스(DB 호출부)가 얇아지고, 정책(우선순위/스킵 규칙) 테스트가 쉬워집니다.
 *
 * 규칙:
 * 1. 이름 정규화 매칭이 없으면 `noMatchInChildren` 증가.
 * 2. 이미 status === VERIFIED 이면 건드리지 않음 (검증 결과 보존).
 * 3. 이미 동일 documentId로 연결되어 있으면 no-op.
 * 4. 다른 documentId에 연결되어 있으면 건드리지 않음 (사용자가 의도적으로
 *    다른 문서를 올렸을 수 있음 — 부모로 덮어쓰기보다 수동 해결 권장).
 * 5. 그 외(미연결 또는 같은 docId면서 status 미변경 등)는 업데이트 계획에
 *    포함.
 */
export function planPropagation(
  parentDocuments: PropagationInputDocument[],
  children: PropagationInputChild[],
): PropagationPlan {
  const plan: PropagationPlan = {
    updates: [],
    skippedBecauseVerified: 0,
    skippedBecauseAlreadyLinkedToSame: 0,
    skippedBecauseLinkedToOther: 0,
    noMatchInChildren: 0,
  };

  for (const doc of parentDocuments) {
    let anyChildMatched = false;
    for (const child of children) {
      for (const item of child.checklistItems) {
        if (!isMatchingDocName(doc.name, item.name)) continue;
        anyChildMatched = true;

        if (item.status === "VERIFIED") {
          plan.skippedBecauseVerified += 1;
          continue;
        }
        if (item.documentId === doc.id) {
          plan.skippedBecauseAlreadyLinkedToSame += 1;
          continue;
        }
        if (item.documentId != null && item.documentId !== doc.id) {
          plan.skippedBecauseLinkedToOther += 1;
          continue;
        }
        plan.updates.push({
          childProjectId: child.id,
          checklistItemId: item.id,
          fromDocumentId: item.documentId,
          toDocumentId: doc.id,
          itemName: item.name,
        });
      }
    }
    if (!anyChildMatched) plan.noMatchInChildren += 1;
  }

  return plan;
}
