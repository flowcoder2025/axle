/**
 * In-memory push subscription store (Phase 4 simplicity).
 *
 * Maps userId → PushSubscription. In a production setup this would be
 * persisted in a dedicated DB table or in User.metadata.
 *
 * Extracted here so it can be imported by both the route handler and
 * server-side notification dispatch code without violating Next.js
 * Route Segment Config (route files may only export HTTP method handlers).
 */

export type StoredPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

const pushSubscriptions = new Map<string, StoredPushSubscription>();

/**
 * Save (or overwrite) the push subscription for a user.
 * One active subscription per user for Phase 4.
 */
export function setPushSubscription(
  userId: string,
  subscription: StoredPushSubscription
): void {
  pushSubscriptions.set(userId, subscription);
}

/**
 * Remove the push subscription for a user.
 */
export function deletePushSubscription(userId: string): void {
  pushSubscriptions.delete(userId);
}

/**
 * Retrieve a stored subscription by userId.
 * Returns null when the user has no registered subscription.
 */
export function getPushSubscription(
  userId: string
): StoredPushSubscription | null {
  return pushSubscriptions.get(userId) ?? null;
}
