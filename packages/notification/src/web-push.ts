import webpush from "web-push";

/**
 * PushSubscription shape compatible with the Web Push API.
 */
export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushPayload {
  title: string;
  body: string;
  link?: string;
}

// ── VAPID lazy singleton ──────────────────────────────────────────────────────

/**
 * Cache the VAPID key fingerprint that was used to initialise web-push.
 * If the keys change between calls (e.g. in tests), we re-initialise.
 * In production the keys never change, so setVapidDetails is called once.
 */
let vapidFingerprint: string | null = null;

function ensureVapidConfigured(): void {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL;

  if (!publicKey || !privateKey || !email) {
    throw new Error(
      "Missing VAPID configuration. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_EMAIL."
    );
  }

  const fingerprint = `${publicKey}:${privateKey}:${email}`;
  if (vapidFingerprint === fingerprint) return;

  webpush.setVapidDetails(`mailto:${email}`, publicKey, privateKey);
  vapidFingerprint = fingerprint;
}

/**
 * sendPushNotification — send a Web Push notification to a single subscription.
 *
 * Requires env vars: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL
 *
 * setVapidDetails is called at most once per unique set of VAPID keys
 * (lazy singleton pattern), avoiding redundant re-configuration on every send.
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushPayload
): Promise<void> {
  ensureVapidConfigured();

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    ...(payload.link !== undefined ? { link: payload.link } : {}),
  });

  await webpush.sendNotification(subscription, body);
}
