"use client";

/**
 * WI-323 — BUNDLE parent 프로젝트에서 공통 서류를 자식들에게 전파하는 버튼.
 *
 * 흐름:
 *   1. 클릭 → POST /api/projects/[projectId]/bundle-propagate
 *   2. 응답의 summary를 Alert 카드로 표시 (업데이트/스킵 사유별 카운트)
 *   3. 사용자가 다시 실행해도 동일 결과 (idempotent)
 */

import { useCallback, useState } from "react";
import { Button } from "@axle/ui";
import { Share2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface PropagationSummary {
  parentProjectId: string;
  parentDocumentCount: number;
  childProjectCount: number;
  updatedCount: number;
  skippedBecauseVerified: number;
  skippedBecauseAlreadyLinkedToSame: number;
  skippedBecauseLinkedToOther: number;
  noMatchInChildren: number;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

interface Props {
  projectId: string;
}

export function BundlePropagateButton({ projectId }: Props) {
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<PropagationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    setSummary(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/bundle-propagate`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
        throw new Error(body?.error?.message ?? `전파 실패 (${res.status})`);
      }
      const body = (await res.json()) as { summary: PropagationSummary };
      setSummary(body.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "전파 실패");
    } finally {
      setRunning(false);
    }
  }, [projectId]);

  return (
    <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Share2 className="h-3.5 w-3.5" />
            공통 서류 전파
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            이 BUNDLE에 업로드된 서류를 자식 프로젝트(벤처·연구소·특허)의 동일
            이름 체크리스트 항목에 자동으로 연결합니다. 이미 검증(VERIFIED)된
            항목과 다른 서류가 이미 연결된 항목은 그대로 둡니다. 업데이트된
            항목의 상태는 UPLOADED로 설정됩니다.
          </p>
        </div>
        <Button
          onClick={run}
          disabled={running}
          size="sm"
          data-testid="bundle-propagate-button"
        >
          {running ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              전파 중...
            </>
          ) : (
            <>
              <Share2 className="mr-1.5 h-3.5 w-3.5" />
              자식에게 전파
            </>
          )}
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span data-testid="bundle-propagate-error">{error}</span>
        </div>
      )}

      {summary && (
        <div
          className="rounded-md border bg-background p-3 text-sm space-y-1.5"
          data-testid="bundle-propagate-summary"
          role="status"
        >
          <div className="flex items-center gap-1.5 font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            전파 완료
          </div>
          <dl className="grid grid-cols-[200px_1fr] gap-y-1 text-xs">
            <dt className="text-muted-foreground">업데이트됨</dt>
            <dd className="font-mono tabular-nums">{summary.updatedCount}건</dd>
            <dt className="text-muted-foreground">부모 서류 수</dt>
            <dd className="font-mono tabular-nums">
              {summary.parentDocumentCount}건
            </dd>
            <dt className="text-muted-foreground">자식 프로젝트 수</dt>
            <dd className="font-mono tabular-nums">
              {summary.childProjectCount}개
            </dd>
            <dt className="text-muted-foreground">검증 항목(보존)</dt>
            <dd className="font-mono tabular-nums">
              {summary.skippedBecauseVerified}건
            </dd>
            <dt className="text-muted-foreground">이미 동일 연결(no-op)</dt>
            <dd className="font-mono tabular-nums">
              {summary.skippedBecauseAlreadyLinkedToSame}건
            </dd>
            <dt className="text-muted-foreground">다른 서류 연결(보존)</dt>
            <dd className="font-mono tabular-nums">
              {summary.skippedBecauseLinkedToOther}건
            </dd>
            <dt className="text-muted-foreground">자식에 이름 매칭 없음</dt>
            <dd className="font-mono tabular-nums">
              {summary.noMatchInChildren}건
            </dd>
          </dl>
        </div>
      )}
    </div>
  );
}
