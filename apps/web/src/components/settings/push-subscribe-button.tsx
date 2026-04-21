"use client";

/**
 * PushSubscribeButton (WI-226)
 *
 * Browser-side flow for Web Push:
 *   1. Detect existing subscription from the active Service Worker registration.
 *   2. On "enable":
 *        - request Notification permission
 *        - register `/service-worker.js` (scope `/`)
 *        - fetch VAPID public key from `/api/push/vapid-public-key`
 *        - call `pushManager.subscribe({ applicationServerKey, userVisibleOnly })`
 *        - POST the raw subscription JSON to `/api/push/subscribe`
 *   3. On "disable":
 *        - `subscription.unsubscribe()` in the browser
 *        - DELETE `{ endpoint }` on `/api/push/subscribe` so the DB row is removed
 *
 * Unsupported browsers render a disabled button with an explanation.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@axle/ui";

type Status = "loading" | "unsupported" | "unsubscribed" | "subscribed" | "error";

const SERVICE_WORKER_URL = "/service-worker.js";
const VAPID_ENDPOINT = "/api/push/vapid-public-key";
const SUBSCRIBE_ENDPOINT = "/api/push/subscribe";

function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** base64url → Uint8Array for VAPID applicationServerKey. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

function subscriptionToPayload(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    },
  };
}

export function PushSubscribeButton() {
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Detect the current subscription state on mount.
  useEffect(() => {
    let cancelled = false;

    async function detect() {
      if (!isPushSupported()) {
        if (!cancelled) setStatus("unsupported");
        return;
      }

      try {
        const registration = await navigator.serviceWorker.getRegistration(
          "/"
        );
        const existing = registration
          ? await registration.pushManager.getSubscription()
          : null;
        if (cancelled) return;
        setStatus(existing ? "subscribed" : "unsubscribed");
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : "unknown error");
        setStatus("error");
      }
    }

    void detect();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleEnable = useCallback(async () => {
    setBusy(true);
    setErrorMessage(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error(
          "알림 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요."
        );
      }

      const registration = await navigator.serviceWorker.register(
        SERVICE_WORKER_URL,
        { scope: "/" }
      );
      await navigator.serviceWorker.ready;

      const vapidRes = await fetch(VAPID_ENDPOINT, { cache: "no-store" });
      if (!vapidRes.ok) {
        throw new Error(
          `VAPID 공개키를 가져오지 못했습니다 (HTTP ${vapidRes.status})`
        );
      }
      const { publicKey } = (await vapidRes.json()) as { publicKey?: string };
      if (!publicKey) {
        throw new Error("VAPID 공개키가 서버에 설정되어 있지 않습니다.");
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast to BufferSource — TS 5.7 narrows Uint8Array with the new
        // ArrayBufferLike parameter which does not satisfy BufferSource directly.
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const saveRes = await fetch(SUBSCRIBE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscriptionToPayload(subscription)),
      });
      if (!saveRes.ok) {
        // Roll back local subscription if we couldn't persist it.
        await subscription.unsubscribe().catch(() => undefined);
        throw new Error(
          `구독 저장 실패 (HTTP ${saveRes.status})`
        );
      }

      setStatus("subscribed");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "unknown error");
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }, []);

  const handleDisable = useCallback(async () => {
    setBusy(true);
    setErrorMessage(null);

    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = registration
        ? await registration.pushManager.getSubscription()
        : null;

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await fetch(SUBSCRIBE_ENDPOINT, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }

      setStatus("unsubscribed");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "unknown error");
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <Card data-testid="push-subscribe-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          브라우저 푸시 알림
          {status === "subscribed" ? (
            <Badge variant="default">구독중</Badge>
          ) : null}
          {status === "unsupported" ? (
            <Badge variant="secondary">지원 안 함</Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          실시간 알림을 브라우저에서 바로 받을 수 있습니다. 기기/브라우저마다
          별도로 구독해야 합니다.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {status === "unsupported" ? (
          <p className="text-sm text-muted-foreground">
            이 브라우저는 Web Push를 지원하지 않습니다. Chrome, Edge, Firefox
            데스크탑 버전을 사용해주세요.
          </p>
        ) : null}

        {status === "loading" ? (
          <p className="text-sm text-muted-foreground">구독 상태 확인 중…</p>
        ) : null}

        {status === "unsubscribed" || status === "error" ? (
          <Button
            onClick={handleEnable}
            disabled={busy}
            data-testid="push-subscribe-enable"
          >
            {busy ? "구독 중…" : "푸시 알림 켜기"}
          </Button>
        ) : null}

        {status === "subscribed" ? (
          <Button
            onClick={handleDisable}
            disabled={busy}
            variant="outline"
            data-testid="push-subscribe-disable"
          >
            {busy ? "해제 중…" : "푸시 알림 끄기"}
          </Button>
        ) : null}

        {errorMessage ? (
          <p
            className="text-sm text-destructive"
            data-testid="push-subscribe-error"
          >
            {errorMessage}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
