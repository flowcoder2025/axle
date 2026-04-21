"use client";

import { useEffect, useState } from "react";
import { Badge, Button } from "@axle/ui";
import { Sparkles, Loader2 } from "lucide-react";

export interface VerificationItem {
  name: string;
  weight: number;
  score: number;
  feedback: string;
}

export interface VerificationResultData {
  score: number;
  grade: string;
  items: VerificationItem[];
  suggestions: string[];
  strengths: string[];
  weaknesses: string[];
  verifiedAt: string | null;
}

interface VerificationPanelProps {
  documentId: string;
}

const GRADE_COLOR: Record<string, string> = {
  A: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40 dark:text-emerald-300",
  B: "bg-sky-500/15 text-sky-700 border-sky-500/40 dark:text-sky-300",
  C: "bg-amber-500/15 text-amber-700 border-amber-500/40 dark:text-amber-300",
  D: "bg-orange-500/15 text-orange-700 border-orange-500/40 dark:text-orange-300",
  F: "bg-rose-500/15 text-rose-700 border-rose-500/40 dark:text-rose-300",
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR");
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, (score / 10) * 100));
  const colorClass =
    score >= 8
      ? "bg-emerald-500"
      : score >= 5
        ? "bg-amber-500"
        : "bg-rose-500";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full ${colorClass} transition-all`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function VerificationPanel({ documentId }: VerificationPanelProps) {
  const [result, setResult] = useState<VerificationResultData | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load any existing verification result on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/documents/${documentId}/verify`);
        if (!res.ok) {
          setInitialLoading(false);
          return;
        }
        const json = await res.json();
        if (!cancelled && json.data) {
          setResult(json.data as VerificationResultData);
        }
      } catch {
        // ignore — user can still run evaluation
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  async function runEvaluation() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/verify`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "평가에 실패했습니다.");
      }
      setResult(json.data as VerificationResultData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (initialLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        불러오는 중...
      </div>
    );
  }

  return (
    <div
      className="space-y-4 rounded-lg border bg-card p-4"
      data-testid="verification-panel"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">사업계획서 평가</h3>
          {result?.verifiedAt && (
            <span className="text-xs text-muted-foreground">
              최근 평가: {formatDateTime(result.verifiedAt)}
            </span>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          onClick={runEvaluation}
          disabled={loading}
          data-testid="verification-run"
        >
          {loading ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              평가 중...
            </>
          ) : result ? (
            "다시 평가"
          ) : (
            "평가 실행"
          )}
        </Button>
      </div>

      {error && (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      {!result && !error && (
        <p className="text-sm text-muted-foreground">
          평가를 실행하면 사업계획서의 점수·등급·개선 제안이 표시됩니다. OCR
          완료된 문서 또는 텍스트 기반 문서에 사용 가능합니다.
        </p>
      )}

      {result && (
        <div className="space-y-4" data-testid="verification-result">
          <div className="flex items-center gap-3">
            <div
              className={`inline-flex h-12 w-12 items-center justify-center rounded-full border-2 text-lg font-bold ${GRADE_COLOR[result.grade] ?? GRADE_COLOR["C"]}`}
              data-testid="verification-grade"
            >
              {result.grade}
            </div>
            <div>
              <div className="text-2xl font-bold" data-testid="verification-score">
                {result.score.toFixed(1)}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}
                  / 10
                </span>
              </div>
              <p className="text-xs text-muted-foreground">총점</p>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">항목별 점수</h4>
            <ul className="space-y-2">
              {result.items.map((item) => (
                <li key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {item.score.toFixed(1)} / 10
                      <span className="ml-2 text-xs">
                        (가중치 {(item.weight * 100).toFixed(0)}%)
                      </span>
                    </span>
                  </div>
                  <ScoreBar score={item.score} />
                  <p className="text-xs text-muted-foreground">
                    {item.feedback}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {result.strengths.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-sm font-semibold">강점</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {result.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                    >
                      강점
                    </Badge>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.suggestions.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-sm font-semibold">개선 제안</h4>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {result.suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
