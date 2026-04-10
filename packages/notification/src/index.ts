/**
 * @axle/notification — Notification CRUD helpers
 *
 * Export map:
 * - create, getUnread, markRead, markAllRead, getByUser, deleteOne → CRUD operations
 * - NotificationPayload, NotificationChannel → Types
 */

export const NOTIFICATION_PACKAGE = "@axle/notification" as const;

export { create, getUnread, markRead, markAllRead, getByUser, deleteOne } from "./crud.js";

export type { NotificationPayload, NotificationChannel, NotificationType } from "./types.js";
