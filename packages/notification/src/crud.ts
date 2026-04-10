import { prisma } from "@axle/db";
import type { NotificationPayload } from "./types.js";

/**
 * create — insert a new notification record.
 */
export async function create(payload: NotificationPayload) {
  return prisma.notification.create({
    data: {
      userId: payload.userId,
      type: payload.type,
      title: payload.title,
      body: payload.body ?? null,
      link: payload.link ?? null,
    },
  });
}

/**
 * getUnread — return all unread notifications for a user, newest first.
 */
export async function getUnread(userId: string) {
  return prisma.notification.findMany({
    where: { userId, isRead: false },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * markRead — mark a single notification as read (only if it belongs to userId).
 * Returns null when the notification is not found or does not belong to the user.
 */
export async function markRead(notificationId: string, userId: string) {
  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
    select: { id: true },
  });
  if (!existing) return null;

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

/**
 * markAllRead — bulk-mark all unread notifications for a user as read.
 * Returns the count of updated records.
 */
export async function markAllRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return result.count;
}

/**
 * getByUser — paginated list of notifications for a user with optional filters.
 */
export async function getByUser(
  userId: string,
  opts: {
    type?: string;
    isRead?: boolean;
    page?: number;
    pageSize?: number;
  } = {}
) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where = {
    userId,
    ...(opts.type !== undefined ? { type: opts.type as never } : {}),
    ...(opts.isRead !== undefined ? { isRead: opts.isRead } : {}),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return { notifications, total, page, pageSize, unreadCount };
}

/**
 * deleteOne — delete a notification (only if it belongs to userId).
 * Returns null when not found or ownership mismatch.
 */
export async function deleteOne(notificationId: string, userId: string) {
  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
    select: { id: true },
  });
  if (!existing) return null;

  await prisma.notification.delete({ where: { id: notificationId } });
  return { deleted: true };
}
