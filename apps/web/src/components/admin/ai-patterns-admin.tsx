"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Badge,
  Input,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  toast,
  cn,
} from "@axle/ui";
import { ChevronDown, ChevronRight, Loader2, Rocket } from "lucide-react";

type PatternRow = {
  id: string;
  name: string;
  taskType: string;
  successCount: number;
  isFineTuned: boolean;
  status: string;
  errorMessage: string | null;
  loraAdapterUrl: string | null;
  lastUsedAt: string | null;
  fineTuneStartedAt: string | null;
  fineTuneCompletedAt: string | null;
  promotedAt: string | null;
  createdAt: string;
  avgCost: number | null;
  sampleInput: unknown;
  sampleOutput: unknown;
  inputSchema: unknown;
  outputSchema: unknown;
};

type Props = {
  patterns: PatternRow[];
  total: number;
  candidateCount: number;
  currentFilter: {
    candidatesOnly: boolean;
    taskType: string | null;
  };
};

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  IDLE: { label: "IDLE", variant: "outline" },
  CANDIDATE: { label: "CANDIDATE", variant: "secondary" },
  QUEUED: { label: "QUEUED", variant: "secondary" },
  FINE_TUNING: { label: "FINE_TUNING", variant: "default" },
  COMPLETED: { label: "COMPLETED", variant: "default" },
  PROMOTED: { label: "PROMOTED", variant: "default" },
  FAILED: { label: "FAILED", variant: "destructive" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCost(cost: number | null): string {
  if (cost === null) return "-";
  return `$${cost.toFixed(4)}`;
}

export function AiPatternsAdmin({
  patterns,
  total,
  candidateCount,
  currentFilter,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [promoteDialog, setPromoteDialog] = useState<PatternRow | null>(null);

  const refresh = () => {
    startTransition(() => router.refresh());
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCandidatesFilter = () => {
    const params = new URLSearchParams();
    if (!currentFilter.candidatesOnly) params.set("candidatesOnly", "true");
    if (currentFilter.taskType) params.set("taskType", currentFilter.taskType);
    router.push(`?${params.toString()}`);
  };

  const startFineTune = async (p: PatternRow) => {
    if (!confirm(`${p.name} 파인튜닝을 시작하시겠습니까?`)) return;
    setBusyId(p.id);
    try {
      const res = await fetch(`/api/ai/patterns/${p.id}/fine-tune`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("파인튜닝 시작 실패", {
          description:
            (body as { error?: { message?: string } })?.error?.message ??
            `HTTP ${res.status}`,
        });
        return;
      }
      toast.success("파인튜닝 큐에 추가되었습니다");
      refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">전체 패턴</div>
          <div className="mt-1 text-xl font-semibold">{total}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">파인튜닝 후보</div>
          <div className="mt-1 text-xl font-semibold">{candidateCount}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">승격됨 (PROMOTED)</div>
          <div className="mt-1 text-xl font-semibold">
            {patterns.filter((p) => p.status === "PROMOTED").length}
          </div>
        </div>
      </div>

      {/* Filter toggle */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={currentFilter.candidatesOnly ? "default" : "outline"}
          onClick={toggleCandidatesFilter}
          disabled={pending}
        >
          파인튜닝 후보만
        </Button>
        {pending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>이름 / Task</TableHead>
              <TableHead className="text-right">성공 수</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>마지막 사용</TableHead>
              <TableHead className="text-right">평균 비용</TableHead>
              <TableHead>액션</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patterns.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  패턴이 없습니다.
                </TableCell>
              </TableRow>
            )}
            {patterns.map((p) => {
              const isExpanded = expanded.has(p.id);
              const isCandidate =
                p.successCount >= 10 &&
                !p.isFineTuned &&
                ["IDLE", "CANDIDATE", "FAILED"].includes(p.status);
              const canPromote =
                p.status === "FINE_TUNING" || p.status === "COMPLETED";

              return (
                <>
                  <TableRow key={p.id}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => toggleExpand(p.id)}
                        aria-label={isExpanded ? "접기" : "샘플 보기"}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.taskType}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {p.successCount}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={STATUS_BADGE[p.status]?.variant ?? "outline"}>
                          {STATUS_BADGE[p.status]?.label ?? p.status}
                        </Badge>
                        {p.isFineTuned && (
                          <Badge variant="default" className="text-[10px]">
                            FINE-TUNED
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatDate(p.lastUsedAt)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatCost(p.avgCost)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {isCandidate && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => startFineTune(p)}
                            disabled={busyId === p.id}
                          >
                            {busyId === p.id && (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            )}
                            파인튜닝 시작
                          </Button>
                        )}
                        {canPromote && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPromoteDialog(p)}
                          >
                            <Rocket className="mr-1 h-3 w-3" />
                            승격
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={`${p.id}-detail`}>
                      <TableCell colSpan={7} className="bg-muted/30">
                        <PatternDetail pattern={p} />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {promoteDialog && (
        <PromoteDialog
          pattern={promoteDialog}
          onClose={() => setPromoteDialog(null)}
          onSaved={() => {
            setPromoteDialog(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function PatternDetail({ pattern }: { pattern: PatternRow }) {
  return (
    <div className="grid grid-cols-1 gap-4 p-3 md:grid-cols-2">
      <section>
        <h4 className="mb-1 text-xs font-semibold text-muted-foreground">
          샘플 입력
        </h4>
        <pre className="max-h-60 overflow-auto rounded-md border border-border bg-background p-2 text-[11px]">
          {pattern.sampleInput
            ? JSON.stringify(pattern.sampleInput, null, 2)
            : "샘플 없음"}
        </pre>
      </section>
      <section>
        <h4 className="mb-1 text-xs font-semibold text-muted-foreground">
          샘플 출력
        </h4>
        <pre className="max-h-60 overflow-auto rounded-md border border-border bg-background p-2 text-[11px]">
          {pattern.sampleOutput
            ? JSON.stringify(pattern.sampleOutput, null, 2)
            : "샘플 없음"}
        </pre>
      </section>
      <section>
        <h4 className="mb-1 text-xs font-semibold text-muted-foreground">
          상태 타임라인
        </h4>
        <ul className="space-y-1 text-xs">
          <li>생성: {formatDate(pattern.createdAt)}</li>
          <li>파인튜닝 시작: {formatDate(pattern.fineTuneStartedAt)}</li>
          <li>파인튜닝 완료: {formatDate(pattern.fineTuneCompletedAt)}</li>
          <li>승격: {formatDate(pattern.promotedAt)}</li>
        </ul>
      </section>
      <section>
        <h4 className="mb-1 text-xs font-semibold text-muted-foreground">
          어댑터 / 오류
        </h4>
        <div className="space-y-1 text-xs">
          <div>
            <span className="text-muted-foreground">LoRA URL: </span>
            {pattern.loraAdapterUrl ? (
              <a
                href={pattern.loraAdapterUrl}
                className="font-mono underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {pattern.loraAdapterUrl}
              </a>
            ) : (
              "없음"
            )}
          </div>
          {pattern.errorMessage && (
            <div className={cn("rounded-md border border-destructive/30 bg-destructive/5 p-2 text-destructive")}>
              {pattern.errorMessage}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function PromoteDialog({
  pattern,
  onClose,
  onSaved,
}: {
  pattern: PatternRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [adapterUrl, setAdapterUrl] = useState(pattern.loraAdapterUrl ?? "");
  const [submitting, setSubmitting] = useState(false);

  const needsAdapter =
    pattern.status === "FINE_TUNING" && !pattern.loraAdapterUrl;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const body =
      pattern.status === "FINE_TUNING" && adapterUrl
        ? JSON.stringify({ loraAdapterUrl: adapterUrl })
        : undefined;

    const res = await fetch(`/api/ai/patterns/${pattern.id}/promote`, {
      method: "POST",
      headers: body ? { "content-type": "application/json" } : undefined,
      body,
    });
    const payload = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      toast.error("승격 실패", {
        description:
          (payload as { error?: { message?: string } })?.error?.message ??
          `HTTP ${res.status}`,
      });
      return;
    }

    const updated = (payload as { data?: { status?: string; errorMessage?: string } })?.data;
    if (updated?.status === "FAILED") {
      toast.error("승격 실패", {
        description: updated.errorMessage ?? "unknown",
      });
    } else if (updated?.status === "PROMOTED") {
      toast.success("LOCAL_MLX로 승격되었습니다");
    } else {
      toast.success("상태가 업데이트되었습니다");
    }
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>LOCAL_MLX 승격</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">패턴:</span>{" "}
              {pattern.name} ({pattern.taskType})
            </div>
            <div className="mt-1">
              <span className="font-medium text-foreground">현재 상태:</span>{" "}
              {pattern.status}
            </div>
          </div>

          {needsAdapter && (
            <div>
              <label className="mb-1 block text-xs font-medium">
                LoRA Adapter URL
              </label>
              <Input
                type="url"
                required
                placeholder="https://..."
                value={adapterUrl}
                onChange={(e) => setAdapterUrl(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                agent-bridge가 이 URL에서 어댑터를 다운로드하여 로컬 MLX에
                로드합니다.
              </p>
            </div>
          )}

          {!needsAdapter && (
            <p className="text-xs text-muted-foreground">
              agent-bridge를 호출하여 LoRA 어댑터를 로컬 MLX로 로드합니다. 실패
              시 상태는 FAILED로 전환됩니다.
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
            >
              취소
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              승격 실행
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
