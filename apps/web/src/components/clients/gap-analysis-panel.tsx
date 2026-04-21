"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button } from "@axle/ui";
import { AlertTriangle, Loader2, Target } from "lucide-react";

interface GapItem {
  category: string;
  item: string;
  severity: "critical" | "major" | "minor";
  description: string;
  recommendation: string;
}

interface GapResult {
  gaps: GapItem[];
  readiness: number;
  summary: string;
}

interface ProgramOption {
  id: string;
  name: string;
  agency?: string | null;
}

interface GapAnalysisPanelProps {
  clientId: string;
}

const SEVERITY_STYLE: Record<GapItem["severity"], string> = {
  // critical = rose, major ≈ orange (high), minor ≈ amber (medium)
  critical:
    "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  major:
    "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  minor:
    "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

const SEVERITY_LABEL: Record<GapItem["severity"], string> = {
  critical: "Critical",
  major: "High",
  minor: "Medium",
};

function ReadinessBar({ readiness }: { readiness: number }) {
  const pct = Math.max(0, Math.min(100, readiness));
  const color =
    readiness >= 80
      ? "bg-emerald-500"
      : readiness >= 60
        ? "bg-amber-500"
        : readiness >= 40
          ? "bg-orange-500"
          : "bg-rose-500";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full ${color} transition-all`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function GapAnalysisPanel({ clientId }: GapAnalysisPanelProps) {
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [programsError, setProgramsError] = useState<string | null>(null);

  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<GapResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPrograms = useCallback(async () => {
    setProgramsLoading(true);
    setProgramsError(null);
    try {
      const res = await fetch(`/api/programs?pageSize=100`);
      if (!res.ok) {
        throw new Error("프로그램 목록을 불러오지 못했습니다.");
      }
      const json = await res.json();
      const items = (json.data ?? []) as ProgramOption[];
      setPrograms(items);
      if (items.length > 0) {
        setSelectedProgramId((prev) => prev || items[0]!.id);
      }
    } catch (err) {
      setProgramsError(
        err instanceof Error ? err.message : "오류가 발생했습니다."
      );
    } finally {
      setProgramsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  async function runAnalysis() {
    if (!selectedProgramId) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/gap-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId: selectedProgramId }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Gap 분석에 실패했습니다.");
      }
      setResult(json.data as GapResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setAnalyzing(false);
    }
  }

  // Group gaps by category for matrix rendering
  const groupedByCategory = (result?.gaps ?? []).reduce<
    Record<string, GapItem[]>
  >((acc, g) => {
    if (!acc[g.category]) acc[g.category] = [];
    acc[g.category]!.push(g);
    return acc;
  }, {});

  return (
    <div className="space-y-4" data-testid="gap-analysis-panel">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Gap 분석</h3>
      </div>

      {programsError ? (
        <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <p>{programsError}</p>
          <button
            type="button"
            onClick={fetchPrograms}
            className="text-sm underline"
          >
            다시 시도
          </button>
        </div>
      ) : programsLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          프로그램 목록을 불러오는 중...
        </div>
      ) : programs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          등록된 지원 프로그램이 없습니다. 프로그램 데이터를 먼저 수집하세요.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="gap-program-select"
              className="text-xs font-medium text-muted-foreground"
            >
              지원 프로그램 선택
            </label>
            <select
              id="gap-program-select"
              data-testid="gap-program-select"
              className="min-w-[280px] rounded-md border bg-background px-3 py-2 text-sm"
              value={selectedProgramId}
              onChange={(e) => setSelectedProgramId(e.target.value)}
            >
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.agency ? ` (${p.agency})` : ""}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            onClick={runAnalysis}
            disabled={analyzing || !selectedProgramId}
            data-testid="gap-run"
          >
            {analyzing ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                분석 중...
              </>
            ) : (
              "Gap 분석 실행"
            )}
          </Button>
        </div>
      )}

      {error && (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4" data-testid="gap-result">
          <div className="space-y-2 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">준비도</p>
              <p
                className="text-lg font-bold tabular-nums"
                data-testid="gap-readiness"
              >
                {result.readiness}
                <span className="text-xs font-normal text-muted-foreground">
                  {" "}
                  / 100
                </span>
              </p>
            </div>
            <ReadinessBar readiness={result.readiness} />
            <p className="pt-2 text-sm text-muted-foreground">
              {result.summary}
            </p>
          </div>

          {result.gaps.length === 0 ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
              미충족 항목이 없습니다. 신청 요건을 모두 충족합니다.
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedByCategory).map(([category, items]) => (
                <div key={category} className="space-y-2">
                  <h4 className="text-sm font-semibold">{category}</h4>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {items.map((gap, idx) => (
                      <li
                        key={`${gap.item}-${idx}`}
                        className={`rounded-md border p-3 text-sm ${SEVERITY_STYLE[gap.severity]}`}
                        data-testid="gap-item"
                        data-severity={gap.severity}
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span className="font-medium">{gap.item}</span>
                          <Badge variant="outline" className="ml-auto text-xs">
                            {SEVERITY_LABEL[gap.severity]}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs opacity-90">
                          {gap.description}
                        </p>
                        <p className="mt-2 text-xs font-medium">
                          권장 조치: {gap.recommendation}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
