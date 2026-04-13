/**
 * Analytics event constants — canonical action names used across client and server.
 */

export { EventCategory } from "@prisma/client";

export const PAGE_PREFIX = "page.";

export const Actions = {
  PROJECT_CREATE: "project.create",
  PROJECT_UPDATE: "project.update",
  PROJECT_DELETE: "project.delete",
  CLIENT_CREATE: "client.create",
  CLIENT_UPDATE: "client.update",
  DOC_UPLOAD: "doc.upload",
  DOC_REQUEST: "doc.request",
  DOC_DOWNLOAD: "doc.download",
  AI_JOB_START: "ai.job.start",
  AI_JOB_COMPLETE: "ai.job.complete",
  AI_JOB_FAILED: "ai.job.failed",
  MATCHING_RUN: "matching.run",
  MATCHING_VIEW: "matching.view",
  MEETING_CREATE: "meeting.create",
  ESTIMATE_CREATE: "estimate.create",
  CONTRACT_CREATE: "contract.create",
  AUTOMATION_RUN: "automation.run",
  AUTOMATION_FAIL: "automation.fail",
  USER_LOGIN: "user.login",
  USER_LOGOUT: "user.logout",
} as const;

export type ActionName = (typeof Actions)[keyof typeof Actions] | `page.${string}`;
