"use client";

import { useEffect, useRef, useCallback } from "react";

export function useNotificationStream(onNewNotification: () => void) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startFallbackPolling = useCallback(() => {
    if (fallbackTimerRef.current) return;
    fallbackTimerRef.current = setInterval(onNewNotification, 30_000);
  }, [onNewNotification]);

  const stopFallbackPolling = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearInterval(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;

    function connect() {
      const es = new EventSource("/api/notifications/stream");
      eventSourceRef.current = es;

      es.onopen = () => {
        retryCount = 0;
        stopFallbackPolling();
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "NEW_NOTIFICATION") onNewNotification();
        } catch {
          /* ignore parse errors */
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        retryCount++;
        if (retryCount <= maxRetries) {
          setTimeout(connect, retryCount * 2000);
        } else {
          startFallbackPolling();
        }
      };
    }

    connect();

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      stopFallbackPolling();
    };
  }, [onNewNotification, startFallbackPolling, stopFallbackPolling]);
}
