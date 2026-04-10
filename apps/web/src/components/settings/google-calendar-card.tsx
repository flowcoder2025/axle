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

const STORAGE_KEY = "google_calendar_tokens";

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  connectedAt: string;
  lastSyncAt?: string;
}

interface SyncResult {
  pushed: number;
  pulled: number;
}

interface State {
  tokens: StoredTokens | null;
  syncing: boolean;
  syncResult: SyncResult | null;
  syncError: string | null;
}

type Action =
  | { type: "LOAD_TOKENS"; tokens: StoredTokens | null }
  | { type: "SYNC_START" }
  | { type: "SYNC_SUCCESS"; result: SyncResult; lastSyncAt: string }
  | { type: "SYNC_ERROR"; message: string }
  | { type: "DISCONNECT" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD_TOKENS":
      return { ...state, tokens: action.tokens };
    case "SYNC_START":
      return { ...state, syncing: true, syncResult: null, syncError: null };
    case "SYNC_SUCCESS":
      return {
        ...state,
        syncing: false,
        syncResult: action.result,
        tokens: state.tokens
          ? { ...state.tokens, lastSyncAt: action.lastSyncAt }
          : null,
      };
    case "SYNC_ERROR":
      return { ...state, syncing: false, syncError: action.message };
    case "DISCONNECT":
      return { ...state, tokens: null, syncResult: null, syncError: null };
    default:
      return state;
  }
}

function loadTokensFromStorage(): StoredTokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return null;
  }
}

function saveTokensToStorage(tokens: StoredTokens): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

function removeTokensFromStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
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

export function GoogleCalendarCard() {
  const [state, dispatch] = useReducer(reducer, {
    tokens: null,
    syncing: false,
    syncResult: null,
    syncError: null,
  });

  // Load tokens from localStorage and handle OAuth callback params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get("gc_access_token");
    const refreshToken = params.get("gc_refresh_token");

    if (accessToken && refreshToken) {
      const tokens: StoredTokens = {
        accessToken,
        refreshToken,
        connectedAt: new Date().toISOString(),
      };
      saveTokensToStorage(tokens);
      dispatch({ type: "LOAD_TOKENS", tokens });

      // Clean up URL params without reload
      const url = new URL(window.location.href);
      url.searchParams.delete("gc_access_token");
      url.searchParams.delete("gc_refresh_token");
      window.history.replaceState({}, "", url.toString());
      return;
    }

    dispatch({ type: "LOAD_TOKENS", tokens: loadTokensFromStorage() });
  }, []);

  // Persist lastSyncAt updates back to storage
  useEffect(() => {
    if (state.tokens) {
      saveTokensToStorage(state.tokens);
    }
  }, [state.tokens]);

  const handleConnect = useCallback(() => {
    window.location.href = "/api/google-calendar/auth";
  }, []);

  const handleSync = useCallback(async () => {
    if (!state.tokens) return;
    dispatch({ type: "SYNC_START" });

    try {
      const res = await fetch("/api/google-calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: state.tokens.accessToken,
          refreshToken: state.tokens.refreshToken,
        }),
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
  }, [state.tokens]);

  const handleDisconnect = useCallback(() => {
    removeTokensFromStorage();
    dispatch({ type: "DISCONNECT" });
  }, []);

  const connected = state.tokens !== null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Google Calendar</CardTitle>
          <Badge
            variant={connected ? "default" : "outline"}
            className={
              connected
                ? "border-transparent bg-green-500 text-white hover:bg-green-500/80"
                : undefined
            }
          >
            {connected ? "연결됨" : "미연결"}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          일정을 Google Calendar와 동기화합니다.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {connected && state.tokens ? (
          <>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>
                연결일:{" "}
                <span className="text-foreground">
                  {formatDateTime(state.tokens.connectedAt)}
                </span>
              </p>
              {state.tokens.lastSyncAt && (
                <p>
                  마지막 동기화:{" "}
                  <span className="text-foreground">
                    {formatDateTime(state.tokens.lastSyncAt)}
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
