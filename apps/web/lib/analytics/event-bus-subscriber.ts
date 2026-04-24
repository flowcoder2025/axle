/**
 * Subscribes to the existing eventBus and auto-tracks BUSINESS category events.
 *
 * Call registerAnalyticsSubscriber() once at app startup (e.g., in instrumentation.ts
 * or a top-level server module).
 */
import { eventBus } from "@/lib/events/event-bus";
import type { BusinessEventKey, EventMap } from "@/lib/events/event-bus";
import { trackEvent } from "./tracker";

const EVENT_ACTION_MAP: Record<BusinessEventKey, string> = {
  DOC_UPLOADED: "doc.upload",
  DOC_REQUESTED: "doc.request",
  DOC_EXPIRING: "doc.expiring",
  DEADLINE_APPROACHING: "deadline.approaching",
  MEETING_SCHEDULED: "meeting.create",
  JOURNAL_DUE: "journal.due",
  ACTION_ITEM_CREATED: "action_item.create",
  ACTION_ITEM_DUE: "action_item.due",
  PROJECT_ASSIGNED: "project.assign",
  MATCHING_RESULT: "matching.result",
  AI_JOB_COMPLETE: "ai.job.complete",
  AI_JOB_FAILED: "ai.job.failed",
  PORTAL_COMPLETE: "portal.complete",
  HANDOFF: "project.handoff",
  PROJECT_COMPLETED: "project.completed",
  CERTIFICATE_RENEWING: "certificate.renewing",
};

function extractUserId(
  _event: BusinessEventKey,
  payload: EventMap[BusinessEventKey]
): string | undefined {
  const p = payload as Record<string, unknown>;
  return (p.uploaderId ?? p.assigneeId ?? p.userId ?? p.fromUserId) as
    | string
    | undefined;
}

let registered = false;

export function registerAnalyticsSubscriber(): void {
  if (registered) return;
  registered = true;

  for (const [eventName, action] of Object.entries(EVENT_ACTION_MAP)) {
    const key = eventName as BusinessEventKey;
    eventBus.on(key, (payload) => {
      const userId = extractUserId(key, payload as EventMap[BusinessEventKey]);
      trackEvent({
        category: "BUSINESS",
        action,
        userId,
        metadata: payload as Record<string, unknown>,
      }).catch(() => {
        // Already logged inside trackEvent
      });
    });
  }
}
