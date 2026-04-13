"use client";

/**
 * useTracker — client-side analytics hook.
 *
 * Automatically tracks PAGE_VIEW on route changes via usePathname().
 * Provides track() for manual FEATURE_USE events.
 * Batches events and sends via sendBeacon on unload or 30s flush.
 * Falls back to localStorage if sendBeacon fails.
 */
import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

type EventPayload = {
  category: "PAGE_VIEW" | "FEATURE_USE";
  action: string;
  label?: string | null;
  value?: number | null;
  path?: string | null;
  referrer?: string | null;
  metadata?: Record<string, unknown> | null;
};

const FLUSH_INTERVAL_MS = 30_000;
const TRACK_ENDPOINT = "/api/analytics/track";
const STORAGE_KEY = "axle_analytics_buffer";
const MAX_STORAGE_EVENTS = 100;

const STORAGE_SID_KEY = "axle_analytics_sid";

function getSessionId(): string {
  const match = document.cookie.match(/(?:^|;\s*)axle_sid=([^;]+)/);
  if (match?.[1]) return match[1];

  // Fallback: generate and persist a client-side session ID
  let sid = localStorage.getItem(STORAGE_SID_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem(STORAGE_SID_KEY, sid);
  }
  return sid;
}

function sendBatch(events: EventPayload[]): boolean {
  if (events.length === 0) return true;

  const payload = JSON.stringify({
    sessionId: getSessionId(),
    events,
  });

  if (typeof navigator.sendBeacon === "function") {
    const sent = navigator.sendBeacon(
      TRACK_ENDPOINT,
      new Blob([payload], { type: "application/json" }),
    );
    if (sent) return true;
  }

  fetch(TRACK_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    bufferToStorage(events);
  });

  return false;
}

function bufferToStorage(events: EventPayload[]): void {
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as EventPayload[];
    const merged = [...existing, ...events].slice(-MAX_STORAGE_EVENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // localStorage unavailable
  }
}

function drainStorage(): EventPayload[] {
  try {
    const events = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as EventPayload[];
    if (events.length > 0) {
      localStorage.removeItem(STORAGE_KEY);
    }
    return events;
  } catch {
    return [];
  }
}

export function useTracker() {
  const queueRef = useRef<EventPayload[]>([]);
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);

  const flush = useCallback(() => {
    const events = queueRef.current.splice(0);
    if (events.length > 0) {
      sendBatch(events);
    }
  }, []);

  const track = useCallback(
    (
      category: "PAGE_VIEW" | "FEATURE_USE",
      action: string,
      opts?: { label?: string; value?: number; metadata?: Record<string, unknown> },
    ) => {
      queueRef.current.push({
        category,
        action,
        label: opts?.label ?? null,
        value: opts?.value ?? null,
        path: window.location.pathname,
        referrer: document.referrer || null,
        metadata: opts?.metadata ?? null,
      });

      if (queueRef.current.length >= 50) {
        flush();
      }
    },
    [flush],
  );

  // Auto-track PAGE_VIEW on route change
  useEffect(() => {
    if (pathname && pathname !== prevPathRef.current) {
      prevPathRef.current = pathname;
      track("PAGE_VIEW", `page.${pathname}`);
    }
  }, [pathname, track]);

  // Drain localStorage buffer on mount
  useEffect(() => {
    const buffered = drainStorage();
    if (buffered.length > 0) {
      sendBatch(buffered);
    }
  }, []);

  // Periodic flush + flush on unload
  useEffect(() => {
    const interval = setInterval(flush, FLUSH_INTERVAL_MS);

    const handleUnload = () => {
      flush();
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
      flush();
    };
  }, [flush]);

  return { track };
}
