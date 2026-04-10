/**
 * Notification Dispatcher (WI-053)
 *
 * Routes a business event to all configured delivery channels in parallel.
 * Channel failures are isolated — one failed channel never blocks others.
 */

import { create } from "./crud.js";
import { sendPushNotification } from "./web-push.js";
import { sendTelegramToDefault } from "./telegram.js";
import { sendDiscordNotification } from "./discord.js";
import { send } from "@axle/email";
import { getTriggerConfig } from "./trigger-map.js";
import type { BusinessEvent, Channel } from "./trigger-map.js";
import type { NotificationType } from "./types.js";

export type { BusinessEvent, Channel };

export interface DispatchPayload {
  event: BusinessEvent;
  title: string;
  body?: string;
  link?: string;
  /** User IDs for IN_APP / PUSH notifications */
  recipientUserIds: string[];
  /** Email addresses for EMAIL channel */
  recipientEmails?: string[];
  /** Phone numbers for SMS / KAKAO channels */
  recipientPhones?: string[];
  /** Arbitrary metadata passed through to channel handlers */
  metadata?: Record<string, unknown>;
}

/**
 * dispatch — fan out a business event to all configured channels.
 *
 * Uses Promise.allSettled so that a failure in one channel never prevents
 * the others from being attempted. Failed channels are logged to stderr.
 */
export async function dispatch(payload: DispatchPayload): Promise<void> {
  const config = getTriggerConfig(payload.event);

  const results = await Promise.allSettled(
    config.channels.map((channel) => sendToChannel(channel, payload))
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "rejected") {
      const channel = config.channels[i];
      const reason =
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
      console.error(
        `[dispatcher] channel=${channel} event=${payload.event} error=${reason}`
      );
    }
  }
}

// ── Private channel senders ───────────────────────────────────────────────────

async function sendToChannel(
  channel: Channel,
  payload: DispatchPayload
): Promise<void> {
  switch (channel) {
    case "IN_APP":
      return sendInApp(payload);

    case "EMAIL":
      return sendEmail(payload);

    case "SMS":
      return sendSms(payload);

    case "KAKAO":
      return sendKakao(payload);

    case "PUSH":
      return sendPush(payload);

    case "TELEGRAM":
      return sendTelegram(payload);

    case "DISCORD":
      return sendDiscord(payload);

    default: {
      // Exhaustiveness guard — TypeScript will catch unknown channels at compile time.
      const _exhaustive: never = channel;
      throw new Error(`Unknown channel: ${String(_exhaustive)}`);
    }
  }
}

async function sendInApp(payload: DispatchPayload): Promise<void> {
  if (payload.recipientUserIds.length === 0) return;

  // Map the business event to the nearest NotificationType enum value.
  const type = eventToNotificationType(payload.event);

  await Promise.all(
    payload.recipientUserIds.map((userId) =>
      create({
        userId,
        type,
        title: payload.title,
        body: payload.body,
        link: payload.link,
      })
    )
  );
}

async function sendEmail(payload: DispatchPayload): Promise<void> {
  const emails = payload.recipientEmails ?? [];
  if (emails.length === 0) return;

  await Promise.all(
    emails.map((to) =>
      send({
        channel: "email",
        options: {
          to,
          subject: payload.title,
          text: payload.body ?? payload.title,
        },
      })
    )
  );
}

async function sendSms(payload: DispatchPayload): Promise<void> {
  const phones = payload.recipientPhones ?? [];
  if (phones.length === 0) return;

  await Promise.all(
    phones.map((to) =>
      send({
        channel: "sms",
        options: {
          to,
          text: payload.body ?? payload.title,
        },
      })
    )
  );
}

async function sendKakao(payload: DispatchPayload): Promise<void> {
  const phones = payload.recipientPhones ?? [];
  if (phones.length === 0) return;

  const templateId =
    typeof payload.metadata?.kakaoTemplateId === "string"
      ? payload.metadata.kakaoTemplateId
      : "default";

  const variables =
    payload.metadata?.kakaoVariables !== null &&
    typeof payload.metadata?.kakaoVariables === "object"
      ? (payload.metadata.kakaoVariables as Record<string, string>)
      : { message: payload.body ?? payload.title };

  await Promise.all(
    phones.map((to) =>
      send({
        channel: "kakao",
        options: { to, templateId, variables },
      })
    )
  );
}

async function sendPush(payload: DispatchPayload): Promise<void> {
  // Push subscriptions must be provided via metadata.
  const subscriptions = Array.isArray(payload.metadata?.pushSubscriptions)
    ? (payload.metadata!.pushSubscriptions as Array<{
        endpoint: string;
        keys: { p256dh: string; auth: string };
      }>)
    : [];

  if (subscriptions.length === 0) return;

  await Promise.all(
    subscriptions.map((sub) =>
      sendPushNotification(sub, {
        title: payload.title,
        body: payload.body ?? payload.title,
        link: payload.link,
      })
    )
  );
}

async function sendTelegram(payload: DispatchPayload): Promise<void> {
  const lines: string[] = [`<b>${payload.title}</b>`];
  if (payload.body) lines.push(payload.body);
  if (payload.link) lines.push(`🔗 ${payload.link}`);
  const message = lines.join("\n");

  await sendTelegramToDefault(message);
}

async function sendDiscord(payload: DispatchPayload): Promise<void> {
  await sendDiscordNotification("", {
    username: "AXLE",
    embeds: [
      {
        title: payload.title,
        description: payload.body,
        url: payload.link,
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Map a BusinessEvent to the corresponding NotificationType Prisma enum value.
 * Enum values mirror the Prisma schema — update both when schema changes.
 */
function eventToNotificationType(event: BusinessEvent): NotificationType {
  const MAP: Record<BusinessEvent, NotificationType> = {
    DOC_UPLOADED: "DOC_UPLOADED",
    DOC_REQUESTED: "DOC_REQUESTED",
    DOC_EXPIRING: "DOC_EXPIRING",
    DEADLINE_APPROACHING: "DEADLINE",
    MEETING_SCHEDULED: "MEETING_NOTIFY",
    JOURNAL_DUE: "JOURNAL_DUE",
    ACTION_ITEM_CREATED: "ACTION_ITEM",
    ACTION_ITEM_DUE: "ACTION_ITEM_DUE",
    PROJECT_ASSIGNED: "PROJECT_ASSIGNED",
    MATCHING_RESULT: "MATCHING_RESULT",
    AI_JOB_COMPLETE: "AI_JOB_COMPLETE",
    AI_JOB_FAILED: "AI_JOB_FAILED",
    PORTAL_COMPLETE: "PORTAL_COMPLETE",
    HANDOFF: "HANDOFF",
  };
  return MAP[event];
}
