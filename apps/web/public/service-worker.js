/* eslint-disable no-undef */
/**
 * AXLE Web Push Service Worker
 *
 * Scope: `/` (must be served from the site root)
 *
 * Handles:
 *   - `install` / `activate` — immediate activation so new deploys take effect
 *   - `push`                 — render notification from server payload
 *   - `notificationclick`    — focus existing tab or open the target URL
 *
 * Expected push payload (JSON, produced by packages/notification/src/web-push.ts):
 *   { title: string, body: string, link?: string }
 */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  /** @type {{ title?: string; body?: string; link?: string }} */
  let data = {};
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (err) {
    // Fallback to text payload if JSON parsing fails.
    try {
      data = { title: "AXLE", body: event.data ? event.data.text() : "" };
    } catch {
      data = { title: "AXLE", body: "" };
    }
  }

  const title = typeof data.title === "string" && data.title ? data.title : "AXLE";
  const body = typeof data.body === "string" ? data.body : "";
  const url = typeof data.link === "string" && data.link ? data.link : "/";

  const options = {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification.data && typeof event.notification.data.url === "string"
      ? event.notification.data.url
      : "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Focus an existing tab on the same origin if possible.
      for (const client of allClients) {
        try {
          const clientUrl = new URL(client.url);
          const target = new URL(targetUrl, self.location.origin);
          if (clientUrl.origin === target.origin) {
            await client.focus();
            if ("navigate" in client) {
              await client.navigate(target.toString());
            }
            return;
          }
        } catch {
          // Ignore invalid URLs — fall back to openWindow.
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});
