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

function getVapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL;

  if (!publicKey || !privateKey || !email) {
    throw new Error(
      "Missing VAPID configuration. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_EMAIL."
    );
  }

  return { publicKey, privateKey, email };
}

/**
 * sendPushNotification — send a Web Push notification to a single subscription.
 *
 * Requires env vars: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushPayload
): Promise<void> {
  const { publicKey, privateKey, email } = getVapidConfig();

  webpush.setVapidDetails(`mailto:${email}`, publicKey, privateKey);

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    ...(payload.link !== undefined ? { link: payload.link } : {}),
  });

  await webpush.sendNotification(subscription, body);
}
