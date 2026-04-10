/**
 * Notification Trigger Map (WI-052)
 *
 * Maps each business event to the channels it should be delivered on,
 * the recipient role, and the priority level.
 */

export type BusinessEvent =
  | "DOC_REQUESTED"
  | "DOC_UPLOADED"
  | "DOC_EXPIRING"
  | "DEADLINE_APPROACHING"
  | "MEETING_SCHEDULED"
  | "JOURNAL_DUE"
  | "ACTION_ITEM_CREATED"
  | "ACTION_ITEM_DUE"
  | "PROJECT_ASSIGNED"
  | "MATCHING_RESULT"
  | "AI_JOB_COMPLETE"
  | "AI_JOB_FAILED"
  | "PORTAL_COMPLETE"
  | "HANDOFF";

export type Channel =
  | "IN_APP"
  | "EMAIL"
  | "SMS"
  | "KAKAO"
  | "PUSH"
  | "TELEGRAM"
  | "DISCORD";

export type RecipientRole =
  | "assignee"
  | "team"
  | "client_contact"
  | "all_members";

export type Priority = "low" | "normal" | "high" | "urgent";

export interface TriggerConfig {
  channels: Channel[];
  recipientRole: RecipientRole;
  priority: Priority;
}

const TRIGGER_MAP: Record<BusinessEvent, TriggerConfig> = {
  DOC_UPLOADED: {
    channels: ["IN_APP", "EMAIL"],
    recipientRole: "assignee",
    priority: "normal",
  },
  DOC_REQUESTED: {
    channels: ["EMAIL", "SMS"],
    recipientRole: "client_contact",
    priority: "normal",
  },
  DOC_EXPIRING: {
    channels: ["IN_APP"],
    recipientRole: "assignee",
    priority: "normal",
  },
  DEADLINE_APPROACHING: {
    channels: ["IN_APP", "TELEGRAM"],
    recipientRole: "assignee",
    priority: "high",
  },
  MEETING_SCHEDULED: {
    channels: ["IN_APP"],
    recipientRole: "all_members",
    priority: "normal",
  },
  JOURNAL_DUE: {
    channels: ["EMAIL", "SMS"],
    recipientRole: "client_contact",
    priority: "normal",
  },
  ACTION_ITEM_CREATED: {
    channels: ["IN_APP"],
    recipientRole: "assignee",
    priority: "normal",
  },
  ACTION_ITEM_DUE: {
    channels: ["IN_APP"],
    recipientRole: "assignee",
    priority: "high",
  },
  PROJECT_ASSIGNED: {
    channels: ["IN_APP", "EMAIL"],
    recipientRole: "assignee",
    priority: "normal",
  },
  MATCHING_RESULT: {
    channels: ["IN_APP"],
    recipientRole: "assignee",
    priority: "low",
  },
  AI_JOB_COMPLETE: {
    channels: ["IN_APP", "DISCORD"],
    recipientRole: "assignee",
    priority: "normal",
  },
  AI_JOB_FAILED: {
    channels: ["IN_APP", "TELEGRAM", "DISCORD"],
    recipientRole: "assignee",
    priority: "urgent",
  },
  PORTAL_COMPLETE: {
    channels: ["IN_APP", "TELEGRAM"],
    recipientRole: "assignee",
    priority: "normal",
  },
  HANDOFF: {
    channels: ["IN_APP", "EMAIL"],
    recipientRole: "assignee",
    priority: "high",
  },
};

/**
 * getTriggerConfig — look up the delivery configuration for a business event.
 *
 * @throws {Error} when the event key is not registered in the map (development guard).
 */
export function getTriggerConfig(event: BusinessEvent): TriggerConfig {
  const config = TRIGGER_MAP[event];
  if (!config) {
    // Should never happen at runtime given the exhaustive type, but guard for safety.
    throw new Error(`No trigger config found for event: ${event}`);
  }
  return config;
}

/** Expose the full map for introspection / testing. */
export { TRIGGER_MAP };
