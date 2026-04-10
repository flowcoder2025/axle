import type { ProjectStatus } from "@prisma/client";

export const VALID_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  INTAKE: ["DOC_COLLECTING"],
  DOC_COLLECTING: ["IN_PROGRESS"],
  IN_PROGRESS: ["REVIEW"],
  REVIEW: ["SUBMITTED"],
  SUBMITTED: ["APPROVED", "REJECTED"],
  APPROVED: ["COMPLETED"],
  REJECTED: ["IN_PROGRESS"], // allow retry
  COMPLETED: [], // terminal
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
  INTAKE: "접수",
  DOC_COLLECTING: "서류 수집 중",
  IN_PROGRESS: "진행 중",
  REVIEW: "검토 중",
  SUBMITTED: "제출 완료",
  APPROVED: "승인",
  REJECTED: "반려",
  COMPLETED: "완료",
};

export function canTransition(from: ProjectStatus, to: ProjectStatus): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed.includes(to);
}

export function getValidTransitions(status: ProjectStatus): ProjectStatus[] {
  return VALID_TRANSITIONS[status];
}

export function getStatusLabel(status: ProjectStatus): string {
  return STATUS_LABELS[status];
}
