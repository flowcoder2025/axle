"use client";

import { useEffect, useReducer, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Button,
} from "@axle/ui";

const LEGACY_STORAGE_KEY = "google_calendar_tokens";

interface SyncResult {
  pushed: number;
  pulled: number;
}

interface State {
  connected: boolean;
  connectedAt: string | null;
  loading: boolean;
  syncing: boolean;
  syncResult: SyncResult | null;
  syncError: string | null;
  lastSyncAt: string | null;
}

type Action =
  | { type: "STATUS_LOADED"; connected: boolean; connectedAt: string | null }
  | { type: "SYNC_START" }
  | { type: "SYNC_SUCCESS"; result: SyncResult; lastSyncAt: string }
  | { type: "SYNC_ERROR"; message: string }
  | { type: "DISCONNECT" }
  | { type: "LOADING_DONE" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "STATUS_LOADED":
      return {
        ...state,
        connected: action.connected,
        connectedAt: action.connectedAt,
        loading: false,
      };
    case "SYNC_START":
      return { ...state, syncing: true, syncResult: null, syncError: null };
    case "SYNC_SUCCESS":
      return {
        ...state,
        syncing: false,
        syncResult: action.result,
        lastSyncAt: action.lastSyncAt,
      };
    case "SYNC_ERROR":
      return { ...state, syncing: false, syncError: action.message };
    case "DISCONNECT":
      return {
        ...state,
        connected: false,
        connectedAt: null,
        syncResult: null,
        syncError: null,
        lastSyncAt: null,
      };
    case "LOADING_DONE":
      return { ...state, loading: false };
    default:
      return state;
  }
}

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * One-time migration: if old localStorage tokens exist,
 * POST them to the server, then remove from localStorage.
 */
async function migrateFromLocalStorage(): Promise<boolean> {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return false;

    const legacy = JSON.parse(raw) as {
      accessToken?: string;
      refreshToken?: string;
    };
    if (!legacy.accessToken) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return false;
    }

    const res = await fetch("/api/oauth/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "GOOGLE",
        accessToken: legacy.accessToken,
        refreshToken: legacy.refreshToken ?? null,
      }),
    });

    if (res.ok) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return true;
    }
  } catch {
    // Migration failure is non-fatal — tokens stay in localStorage for next attempt
  }
  return false;
}

export function GoogleCalendarCard() {
  const [state, dispatch] = useReducer(reducer, {
    connected: false,
    connectedAt: null,
    loading: true,
    syncing: false,
    syncResult: null,
    syncError: null,
    lastSyncAt: null,
  });

  // Check connection status on mount, with optional localStorage migration
  useEffect(() => {
    async function checkStatus() {
      // Attempt one-time migration from localStorage
      await migrateFromLocalStorage();

      // Clean up gc_connected query param if present
      const params = new URLSearchParams(window.location.search);
      if (params.has("gc_connected") || params.has("gc_error")) {
        const url = new URL(window.location.href);
        url.searchParams.delete("gc_connected");
        url.searchParams.delete("gc_error");
        window.history.replaceState({}, "", url.toString());
      }

      try {
        const res = await fetch("/api/oauth/tokens?provider=GOOGLE");
        if (res.ok) {
          const json = await res.json();
          dispatch({
            type: "STATUS_LOADED",
            connected: json.data.connected,
            connectedAt: json.data.connectedAt,
          });
          return;
        }
      } catch {
        // Network error — show as disconnected
      }
      dispatch({ type: "LOADING_DONE" });
    }

    checkStatus();
  }, []);

  const handleConnect = useCallback(() => {
    window.location.href = "/api/google-calendar/auth";
  }, []);

  const handleSync = useCallback(async () => {
    if (!state.connected) return;
    dispatch({ type: "SYNC_START" });

    try {
      const res = await fetch("/api/google-calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const json = await res.json();

      if (!res.ok) {
        const message =
          json?.error?.message ?? `동기화 실패 (${res.status})`;
        dispatch({ type: "SYNC_ERROR", message });
        return;
      }

      dispatch({
        type: "SYNC_SUCCESS",
        result: json.data as SyncResult,
        lastSyncAt: new Date().toISOString(),
      });
    } catch {
      dispatch({ type: "SYNC_ERROR", message: "네트워크 오류가 발생했습니다." });
    }
  }, [state.connected]);

  const handleDisconnect = useCallback(async () => {
    try {
      await fetch("/api/oauth/tokens?provider=GOOGLE", { method: "DELETE" });
    } catch {
      // Best-effort — UI still disconnects
    }
    dispatch({ type: "DISCONNECT" });
  }, []);

  if (state.loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Google Calendar</CardTitle>
            <Badge variant="outline">확인 중…</Badge>
          </div>
          <CardDescription className="text-xs">
            일정을 Google Calendar와 동기화합니다.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Google Calendar</CardTitle>
          <Badge
            variant={state.connected ? "default" : "outline"}
            className={
              state.connected
                ? "border-transparent bg-green-500 text-white hover:bg-green-500/80"
                : undefined
            }
          >
            {state.connected ? "연결됨" : "미연결"}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          일정을 Google Calendar와 동기화합니다.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {state.connected ? (
          <>
            <div className="text-xs text-muted-foreground space-y-0.5">
              {state.connectedAt && (
                <p>
                  연결일:{" "}
                  <span className="text-foreground">
                    {formatDateTime(state.connectedAt)}
                  </span>
                </p>
              )}
              {state.lastSyncAt && (
                <p>
                  마지막 동기화:{" "}
                  <span className="text-foreground">
                    {formatDateTime(state.lastSyncAt)}
                  </span>
                </p>
              )}
            </div>

            {state.syncResult && (
              <p className="text-xs text-green-600">
                동기화 완료 — 내보냄 {state.syncResult.pushed}개, 가져옴{" "}
                {state.syncResult.pulled}개
              </p>
            )}

            {state.syncError && (
              <p className="text-xs text-destructive">{state.syncError}</p>
            )}

            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleSync}
                disabled={state.syncing}
              >
                {state.syncing ? "동기화 중…" : "동기화"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
              >
                연결 해제
              </Button>
            </div>
          </>
        ) : (
          <Button variant="default" size="sm" onClick={handleConnect}>
            Google Calendar 연결
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
