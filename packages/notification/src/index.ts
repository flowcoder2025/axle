/**
 * @axle/notification — Notification CRUD helpers + delivery channels
 *
 * Export map:
 * - create, getUnread, markRead, markAllRead, getByUser, deleteOne → CRUD operations
 * - NotificationPayload, NotificationChannel → Types
 * - sendPushNotification                     → Web Push (WI-049)
 * - sendTelegramNotification, sendTelegramToDefault → Telegram Bot (WI-050)
 * - sendDiscordNotification                  → Discord Webhook (WI-051)
 */

export const NOTIFICATION_PACKAGE = "@axle/notification" as const;

export { create, getUnread, markRead, markAllRead, getByUser, deleteOne } from "./crud.js";

export type { NotificationPayload, NotificationChannel, NotificationType } from "./types.js";

export { sendPushNotification } from "./web-push.js";
export type { PushSubscription, PushPayload } from "./web-push.js";

export { sendTelegramNotification, sendTelegramToDefault } from "./telegram.js";

export { sendDiscordNotification } from "./discord.js";
export type { DiscordEmbed, DiscordNotificationOptions } from "./discord.js";
