/**
 * Event Bus Setup (WI-054)
 *
 * Registers all 14 business event handlers on the singleton eventBus.
 * Each handler resolves recipients from the event payload and delegates
 * to the notification dispatcher.
 *
 * Call setupEventHandlers() once at application startup (e.g. in instrumentation.ts).
 */

import { eventBus } from "./event-bus";
import { dispatch } from "@axle/notification";

let initialized = false;

export function setupEventHandlers(): void {
  if (initialized) return;
  initialized = true;

  // ── DOC_UPLOADED ──────────────────────────────────────────────────────────
  eventBus.on("DOC_UPLOADED", async (payload) => {
    // DOC_UPLOADED: notify the project assignee, not the uploader.
    // Fall back to an empty list when no assignee is available yet —
    // full resolution from project context will be wired in a future WI.
    await dispatch({
      event: "DOC_UPLOADED",
      title: "서류 업로드 완료",
      body: "새 서류가 업로드되었습니다. 확인해 주세요.",
      recipientUserIds: payload.assigneeId ? [payload.assigneeId] : [],
      metadata: { documentId: payload.documentId, clientId: payload.clientId },
    });
  });

  // ── DOC_REQUESTED ─────────────────────────────────────────────────────────
  eventBus.on("DOC_REQUESTED", async (payload) => {
    // TODO: recipientUserIds needs resolution from project/client context.
    // Will be wired when the document request feature is fully integrated.
    await dispatch({
      event: "DOC_REQUESTED",
      title: "서류 제출 요청",
      body: "서류 제출이 요청되었습니다. 기한 내 업로드해 주세요.",
      recipientUserIds: [],
      metadata: {
        checklistItemId: payload.checklistItemId,
        clientId: payload.clientId,
      },
    });
  });

  // ── DOC_EXPIRING ──────────────────────────────────────────────────────────
  eventBus.on("DOC_EXPIRING", async (payload) => {
    // TODO: recipientUserIds needs resolution from project/client context.
    // Will be wired when document expiry scheduling is fully integrated.
    await dispatch({
      event: "DOC_EXPIRING",
      title: "서류 만료 예정",
      body: `서류가 ${payload.expiresAt.toLocaleDateString("ko-KR")}에 만료됩니다.`,
      recipientUserIds: [],
      metadata: { documentId: payload.documentId, clientId: payload.clientId },
    });
  });

  // ── DEADLINE_APPROACHING ──────────────────────────────────────────────────
  eventBus.on("DEADLINE_APPROACHING", async (payload) => {
    await dispatch({
      event: "DEADLINE_APPROACHING",
      title: "마감일 임박",
      body: `마감일: ${payload.deadlineAt.toLocaleDateString("ko-KR")}`,
      recipientUserIds: payload.assigneeIds,
      metadata: { projectId: payload.projectId },
    });
  });

  // ── MEETING_SCHEDULED ─────────────────────────────────────────────────────
  eventBus.on("MEETING_SCHEDULED", async (payload) => {
    await dispatch({
      event: "MEETING_SCHEDULED",
      title: "회의 일정 등록",
      body: `회의가 ${payload.scheduledAt.toLocaleString("ko-KR")}에 예정되었습니다.`,
      recipientUserIds: payload.attendeeIds,
      metadata: { meetingId: payload.meetingId, projectId: payload.projectId },
    });
  });

  // ── JOURNAL_DUE ───────────────────────────────────────────────────────────
  eventBus.on("JOURNAL_DUE", async (payload) => {
    // TODO: recipientUserIds needs resolution from project/client context.
    // Will be wired when journal reminder scheduling is fully integrated.
    await dispatch({
      event: "JOURNAL_DUE",
      title: "저널 제출 기한",
      body: `저널 제출 기한: ${payload.dueAt.toLocaleDateString("ko-KR")}`,
      recipientUserIds: [],
      metadata: { journalId: payload.journalId, clientId: payload.clientId },
    });
  });

  // ── ACTION_ITEM_CREATED ───────────────────────────────────────────────────
  eventBus.on("ACTION_ITEM_CREATED", async (payload) => {
    await dispatch({
      event: "ACTION_ITEM_CREATED",
      title: "새 액션 아이템",
      body: "새로운 액션 아이템이 배정되었습니다.",
      recipientUserIds: [payload.assigneeId],
      link: `/projects/${payload.projectId}/action-items/${payload.actionItemId}`,
      metadata: { projectId: payload.projectId },
    });
  });

  // ── ACTION_ITEM_DUE ───────────────────────────────────────────────────────
  eventBus.on("ACTION_ITEM_DUE", async (payload) => {
    await dispatch({
      event: "ACTION_ITEM_DUE",
      title: "액션 아이템 기한 임박",
      body: `기한: ${payload.dueAt.toLocaleDateString("ko-KR")}`,
      recipientUserIds: [payload.assigneeId],
      link: `/projects/${payload.projectId}/action-items/${payload.actionItemId}`,
      metadata: { projectId: payload.projectId },
    });
  });

  // ── PROJECT_ASSIGNED ──────────────────────────────────────────────────────
  eventBus.on("PROJECT_ASSIGNED", async (payload) => {
    await dispatch({
      event: "PROJECT_ASSIGNED",
      title: "프로젝트 배정",
      body: "새 프로젝트가 배정되었습니다.",
      recipientUserIds: [payload.userId],
      link: `/projects/${payload.projectId}`,
      metadata: { projectId: payload.projectId },
    });
  });

  // ── MATCHING_RESULT ───────────────────────────────────────────────────────
  eventBus.on("MATCHING_RESULT", async (payload) => {
    await dispatch({
      event: "MATCHING_RESULT",
      title: "매칭 결과 도착",
      body: `매칭 점수: ${payload.score}점`,
      recipientUserIds: [payload.assigneeId],
      metadata: { matchingId: payload.matchingId },
    });
  });

  // ── AI_JOB_COMPLETE ───────────────────────────────────────────────────────
  eventBus.on("AI_JOB_COMPLETE", async (payload) => {
    await dispatch({
      event: "AI_JOB_COMPLETE",
      title: "AI 작업 완료",
      body: `${payload.jobType} 작업이 완료되었습니다.`,
      recipientUserIds: [payload.assigneeId],
      link: payload.resultUrl,
      metadata: { jobId: payload.jobId, jobType: payload.jobType },
    });
  });

  // ── AI_JOB_FAILED ─────────────────────────────────────────────────────────
  eventBus.on("AI_JOB_FAILED", async (payload) => {
    await dispatch({
      event: "AI_JOB_FAILED",
      title: "AI 작업 실패",
      body: `${payload.jobType} 작업 실패: ${payload.errorMessage}`,
      recipientUserIds: [payload.assigneeId],
      metadata: {
        jobId: payload.jobId,
        jobType: payload.jobType,
        errorMessage: payload.errorMessage,
      },
    });
  });

  // ── PORTAL_COMPLETE ───────────────────────────────────────────────────────
  eventBus.on("PORTAL_COMPLETE", async (payload) => {
    await dispatch({
      event: "PORTAL_COMPLETE",
      title: "포털 작업 완료",
      body: "포털 작업이 완료되었습니다.",
      recipientUserIds: [payload.assigneeId],
      metadata: { portalId: payload.portalId, clientId: payload.clientId },
    });
  });

  // ── HANDOFF ───────────────────────────────────────────────────────────────
  eventBus.on("HANDOFF", async (payload) => {
    await dispatch({
      event: "HANDOFF",
      title: "업무 인수인계",
      body: "프로젝트 담당이 변경되었습니다.",
      recipientUserIds: [payload.toUserId],
      link: `/projects/${payload.projectId}`,
      metadata: {
        projectId: payload.projectId,
        fromUserId: payload.fromUserId,
      },
    });
  });
}

/** Reset for testing — clears all handlers so tests start clean. */
export function resetEventHandlers(): void {
  eventBus.removeAllListeners();
  initialized = false;
}
