/**
 * Push subscription store — Prisma-backed (WI-226).
 *
 * Replaces the previous in-memory Map so subscriptions survive server
 * restarts and are available to every serverless instance.
 *
 * Unique key = `endpoint` (a device/browser can have only one active
 * subscription per push service). The same user may register multiple
 * endpoints (desktop + mobile + laptop) — all of them receive push.
 */

import { prisma } from "@axle/db";

export type StoredPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type PersistOptions = {
  userAgent?: string;
};

/**
 * Persist a push subscription for a user. Upserts by `endpoint` so re-subscribing
 * from the same browser updates the keys instead of creating duplicates.
 */
export async function setPushSubscription(
  userId: string,
  subscription: StoredPushSubscription,
  options: PersistOptions = {}
): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: options.userAgent,
    },
    update: {
      userId,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: options.userAgent,
    },
  });
}

/**
 * Remove a single push subscription identified by its push-service endpoint.
 * Called when the browser unsubscribes or reports the endpoint is gone (410).
 */
export async function deletePushSubscription(endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

/**
 * Remove every push subscription for a user (e.g. "sign out everywhere").
 */
export async function deleteAllPushSubscriptionsForUser(
  userId: string
): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { userId } });
}

/**
 * Load every active subscription for a user. Used by the dispatcher when
 * fanning out a PUSH channel notification.
 */
export async function getPushSubscriptionsForUser(
  userId: string
): Promise<StoredPushSubscription[]> {
  const rows = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { endpoint: true, p256dh: true, auth: true },
  });

  return rows.map((row) => ({
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth },
  }));
}
