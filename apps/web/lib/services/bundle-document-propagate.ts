/**
 * WI-323: BUNDLE 공통 서류 전파 — DB 통합 레이어.
 *
 * pure plan(`bundle-document-sharing.ts`)을 실제 Prisma 업데이트로 적용합니다.
 * 분리 이유:
 *   - plan 로직은 DB 없이 테스트 가능 (빠름, 보수 쉬움)
 *   - 여기는 트랜잭션/권한/에러 변환만 담당
 */

import { prisma } from "@axle/db";
import {
  planPropagation,
  type PropagationPlan,
} from "./bundle-document-sharing";

export interface PropagateBundleDocumentsResult extends PropagationPlan {
  parentProjectId: string;
  /** 실제로 업데이트된 ChecklistItem 개수 (== updates.length). */
  updatedCount: number;
  /** 전파 대상 자식 프로젝트 수 (BUNDLE의 children 전체). */
  childProjectCount: number;
  /** 부모 BUNDLE에 업로드되어 있는 Document 개수. */
  parentDocumentCount: number;
}

/**
 * parent BUNDLE 프로젝트의 Document를 자식들 ChecklistItem에 전파합니다.
 *
 * 권한/소유권 검증은 호출자(API route)에서 이미 수행되었다고 가정합니다
 * — 이 함수는 orgId가 아닌 parentProjectId만 받습니다.
 *
 * @throws BUNDLE이 아닌 프로젝트일 때
 */
export async function propagateBundleDocuments(
  parentProjectId: string,
): Promise<PropagateBundleDocumentsResult> {
  const parent = await prisma.project.findUnique({
    where: { id: parentProjectId },
    select: {
      id: true,
      type: true,
      documents: { select: { id: true, name: true } },
      children: {
        select: {
          id: true,
          checklist: {
            select: { id: true, name: true, status: true, documentId: true },
          },
        },
      },
    },
  });

  if (!parent) {
    throw new Error(`Project not found: ${parentProjectId}`);
  }
  if (parent.type !== "BUNDLE") {
    throw new Error(
      `propagateBundleDocuments requires a BUNDLE project; got ${parent.type}`,
    );
  }

  const plan = planPropagation(
    parent.documents.map((d) => ({ id: d.id, name: d.name })),
    parent.children.map((c) => ({
      id: c.id,
      checklistItems: c.checklist.map((i) => ({
        id: i.id,
        name: i.name,
        status: i.status,
        documentId: i.documentId,
      })),
    })),
  );

  // Single transaction so we either apply the whole plan or nothing —
  // partial application would leave the UI in a confusing state where some
  // children show the shared doc and others still prompt for upload.
  if (plan.updates.length > 0) {
    await prisma.$transaction(
      plan.updates.map((u) =>
        prisma.checklistItem.update({
          where: { id: u.checklistItemId },
          data: {
            documentId: u.toDocumentId,
            status: "UPLOADED",
            uploadedAt: new Date(),
          },
        }),
      ),
    );
  }

  return {
    ...plan,
    parentProjectId,
    updatedCount: plan.updates.length,
    childProjectCount: parent.children.length,
    parentDocumentCount: parent.documents.length,
  };
}
