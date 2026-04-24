/**
 * WI-324: BUNDLE 자동 완료 전이.
 *
 * 자식 프로젝트가 COMPLETED로 전이된 직후 호출되어, 부모 BUNDLE의 자식들이
 * 모두 COMPLETED인지 확인하고 모두 완료된 경우 부모도 자동으로 COMPLETED로
 * 전이합니다.
 *
 * 주의:
 * - state machine `canTransition` 체크를 의도적으로 건너뜁니다. 자동 완료는
 *   소비 대상인 사람이 아닌 프로세스가 유발하므로, 부모가 어떤 상태였든
 *   (예: DOC_COLLECTING) 모든 자식이 끝났다면 COMPLETED로 확정해야 합니다.
 *   수동 상태 변경 경로는 여전히 state machine 제약을 따릅니다.
 * - idempotent: 이미 COMPLETED인 부모는 건드리지 않습니다.
 * - 자식이 0건인 BUNDLE은 자동 완료하지 않습니다 (비어있는 BUNDLE은 미완성
 *   상태로 간주 — `every([]) === true`의 함정 방지).
 * - 재귀 없음: BUNDLE 프로젝트의 parent는 스키마상 존재하지 않으므로
 *   이 함수는 한 단계만 타고 올라갑니다.
 */

import { prisma } from "@axle/db";
import { autoCreateCertificateFromProject } from "./project-certificate-auto";
import { eventBus } from "@/lib/events/event-bus";

export type MaybeCompleteBundleResult =
  | { completed: true; parentId: string; completedAt: Date }
  | {
      completed: false;
      reason:
        | "NO_PARENT"
        | "PARENT_NOT_BUNDLE"
        | "ALREADY_COMPLETED"
        | "CHILDREN_PENDING"
        | "NO_CHILDREN";
    };

export async function maybeCompleteBundleParent(
  childProjectId: string,
): Promise<MaybeCompleteBundleResult> {
  const child = await prisma.project.findUnique({
    where: { id: childProjectId },
    select: { parentId: true },
  });
  if (!child?.parentId) {
    return { completed: false, reason: "NO_PARENT" };
  }

  const parent = await prisma.project.findUnique({
    where: { id: child.parentId },
    select: {
      id: true,
      type: true,
      status: true,
      clientId: true,
      title: true,
      children: { select: { status: true } },
    },
  });
  if (!parent) {
    return { completed: false, reason: "NO_PARENT" };
  }
  if (parent.type !== "BUNDLE") {
    return { completed: false, reason: "PARENT_NOT_BUNDLE" };
  }
  if (parent.status === "COMPLETED") {
    return { completed: false, reason: "ALREADY_COMPLETED" };
  }
  if (parent.children.length === 0) {
    // 자식 없는 BUNDLE을 자동 완료시키면 "빈 BUNDLE 생성 → 즉시 COMPLETED"
    // 버그가 생깁니다. `every([])`가 true로 평가되는 함정을 명시적으로 차단.
    return { completed: false, reason: "NO_CHILDREN" };
  }

  const allCompleted = parent.children.every((c) => c.status === "COMPLETED");
  if (!allCompleted) {
    return { completed: false, reason: "CHILDREN_PENDING" };
  }

  const completedAt = new Date();
  await prisma.project.update({
    where: { id: parent.id },
    data: { status: "COMPLETED" },
  });

  // BUNDLE 자체는 인증서 발급 대상 타입이 아니지만, 파이프라인 일관성을 위해
  // 동일 서비스를 호출합니다 — BUNDLE_SKIPPED / UNSUPPORTED_TYPE로 no-op 처리됨.
  const certResult = await autoCreateCertificateFromProject({
    id: parent.id,
    type: parent.type,
    clientId: parent.clientId,
    title: parent.title,
  }).catch((err) => {
    console.error("autoCreateCertificateFromProject(BUNDLE) failed", err);
    return {
      created: false,
      certificateId: null,
      reason: "UNSUPPORTED_TYPE" as const,
    };
  });

  void eventBus
    .emit("PROJECT_COMPLETED", {
      projectId: parent.id,
      projectType: parent.type,
      clientId: parent.clientId,
      completedAt,
      certificateCreated: certResult.created,
      certificateId: certResult.certificateId,
    })
    .catch(console.error);

  return { completed: true, parentId: parent.id, completedAt };
}
