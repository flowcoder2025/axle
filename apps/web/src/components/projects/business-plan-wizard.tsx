"use client";

/**
 * WI-203 — Business Plan Generation Wizard
 *
 * Drives the 3-step wizard (sections → engine/program → progress/result) that
 * talks to POST /api/business-plans (enqueue) and GET /api/business-plans/[jobId]
 * (poll). Polling is AbortController-guarded so it never outlives the dialog.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { Button } from "@axle/ui";
import { Checkbox } from "@axle/ui";
import { Sparkles, X, CheckCircle2, AlertCircle, Loader2, FileDown, ExternalLink, RefreshCw } from "lucide-react";
import type { ProjectType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Wizard section list — mirrors `VENTURE_BUSINESS_PLAN_SECTIONS` in
 * `@axle/docgen` so the user sees the exact same 9 sections the server will
 * generate. Adding/removing a section here without touching the docgen
 * config will silently desynchronise the pipeline, so we import directly.
 */
// Subpath import — types.ts has no runtime deps, so the client bundle stays
// free of server-only dependencies (docx, pdf-parse, etc.).
import { VENTURE_BUSINESS_PLAN_SECTIONS } from "@axle/docgen/sections";

export const WIZARD_SECTIONS: ReadonlyArray<{
  id: string;
  label: string;
  required: boolean;
  instruction: string;
  tips: readonly string[];
  minChars: number;
  maxChars: number;
}> = VENTURE_BUSINESS_PLAN_SECTIONS.map((s) => ({
  id: s.title,
  label: s.title,
  required: s.required,
  instruction: s.instruction,
  tips: s.tips,
  minChars: s.minChars,
  maxChars: s.maxChars,
}));

export const SUPPORTED_PROJECT_TYPES: ReadonlySet<ProjectType> = new Set<ProjectType>([
  "BUSINESS_PLAN",
  "VENTURE_CERT",
  "RESEARCH_INSTITUTE",
  "BUNDLE",
]);

export const POLL_INTERVAL_MS = 5_000;
export const POLL_MAX_DURATION_MS = 10 * 60 * 1_000; // 10 minutes

type Engine = "rag" | "precision" | "both";
type JobStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";

type VerificationResult = {
  passed: boolean;
  score: number;
  issues?: Array<{ ruleId: string; severity: "error" | "warning" | "info"; message: string }>;
  recommendations?: string[];
};

type JobOutput = {
  documentId?: string;
  docxUrl?: string;
  verification?: VerificationResult;
  rag?: { sectionCount: number };
};

interface ProgramOption {
  id: string;
  name: string;
  agency?: string | null;
}

interface BusinessPlanWizardProps {
  projectId: string;
  projectType: ProjectType;
  /**
   * Programs the operator can choose from. When the project already has a
   * programId, the parent should omit this prop so the wizard submits with no
   * override (server falls back to project.programId).
   */
  availablePrograms?: ProgramOption[];
  /**
   * Pre-linked program on the project. If set, the selector hides behind a
   * "변경" affordance so we don't confuse the default case.
   */
  linkedProgram?: { id: string; name: string } | null;
}

// ---------------------------------------------------------------------------
// Progress messaging
// ---------------------------------------------------------------------------

/**
 * Translate raw AiJob status + elapsed time into a human progress message.
 * Kept pure so unit tests can exercise it without mounting the dialog.
 */
export function describeProgress(
  status: JobStatus,
  engine: Engine,
  elapsedMs: number
): { label: string; percent: number } {
  if (status === "QUEUED") {
    return { label: "대기열에 작업을 등록 중…", percent: 5 };
  }
  if (status === "COMPLETED") {
    return { label: "완료되었습니다", percent: 100 };
  }
  if (status === "FAILED") {
    return { label: "생성에 실패했습니다", percent: 100 };
  }

  // RUNNING — estimate phase by elapsed time. Pipeline breakdown in
  // business-plan-pipeline.ts: RAG → Precision DOCX → Verification → Upload.
  const seconds = Math.floor(elapsedMs / 1_000);
  if (engine === "rag") {
    return { label: "RAG 초안 생성 중…", percent: Math.min(15 + seconds, 85) };
  }
  if (engine === "precision") {
    if (seconds < 30) {
      return { label: "DOCX 정밀 편집 중…", percent: 20 + Math.min(seconds, 40) };
    }
    return { label: "자가 평가 + 업로드 중…", percent: 70 };
  }
  // engine === "both"
  if (seconds < 20) {
    return { label: "RAG 초안 생성 중…", percent: 15 + seconds * 2 };
  }
  if (seconds < 60) {
    return { label: "DOCX 정밀 편집 중…", percent: 50 + Math.floor((seconds - 20) / 2) };
  }
  if (seconds < 120) {
    return { label: "자가 평가 수행 중…", percent: 80 };
  }
  return { label: "문서 업로드 + 마무리 중…", percent: 90 };
}

function gradeFromScore(score: number): { grade: string; tone: "success" | "warning" | "danger" } {
  if (score >= 90) return { grade: "A", tone: "success" };
  if (score >= 75) return { grade: "B", tone: "success" };
  if (score >= 60) return { grade: "C", tone: "warning" };
  return { grade: "D", tone: "danger" };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Step = "configure" | "progress" | "done" | "failed";

export function BusinessPlanWizard({
  projectId,
  projectType,
  availablePrograms,
  linkedProgram,
}: BusinessPlanWizardProps) {
  const [open, setOpen] = useState(false);

  if (!SUPPORTED_PROJECT_TYPES.has(projectType)) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
        사업계획서 생성
      </Button>
      {open && (
        <WizardDialog
          projectId={projectId}
          availablePrograms={availablePrograms}
          linkedProgram={linkedProgram}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

interface WizardDialogProps {
  projectId: string;
  availablePrograms?: ProgramOption[];
  linkedProgram?: { id: string; name: string } | null;
  onClose: () => void;
}

function WizardDialog({
  projectId,
  availablePrograms,
  linkedProgram,
  onClose,
}: WizardDialogProps) {
  const initialSections = useMemo(
    () => new Set(WIZARD_SECTIONS.filter((s) => s.required).map((s) => s.id)),
    []
  );

  const [step, setStep] = useState<Step>("configure");
  const [selectedSections, setSelectedSections] = useState<Set<string>>(initialSections);
  const [engine, setEngine] = useState<Engine>("both");
  const [programId, setProgramId] = useState<string>(linkedProgram?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Progress + result state
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus>("QUEUED");
  const [jobOutput, setJobOutput] = useState<JobOutput | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const backdropRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ESC to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // Don't close mid-pipeline without confirmation.
        if (step === "progress") return;
        onClose();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [step, onClose]);

  // Focus trap: move focus into the dialog on open.
  useEffect(() => {
    contentRef.current?.focus();
  }, []);

  // Abort polling on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // -----------------------------------------------------------------------
  // Submit — enqueue the pipeline
  // -----------------------------------------------------------------------

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError(null);

    try {
      // Section list: only non-required that were checked + all required.
      const sections = Array.from(selectedSections);

      const body: {
        projectId: string;
        programId?: string;
        sections: string[];
        engine: Engine;
      } = {
        projectId,
        sections,
        engine,
      };
      if (programId && programId !== linkedProgram?.id) {
        body.programId = programId;
      }

      const res = await fetch("/api/business-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          (json as { error?: { message?: string } }).error?.message ??
          "사업계획서 생성을 시작할 수 없습니다";
        throw new Error(msg);
      }

      const data = (json as { data: { jobId: string; status: JobStatus } }).data;
      setJobId(data.jobId);
      setJobStatus(data.status);
      setStartedAt(Date.now());
      setStep("progress");
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  }, [engine, linkedProgram?.id, programId, projectId, selectedSections]);

  // -----------------------------------------------------------------------
  // Polling
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (step !== "progress" || !jobId || !startedAt) return;

    // Fresh AbortController for each polling session.
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let elapsedTimer: ReturnType<typeof setInterval> | null = null;

    elapsedTimer = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 500);

    async function poll() {
      try {
        const res = await fetch(`/api/business-plans/${jobId}`, {
          signal: ctrl.signal,
        });
        if (ctrl.signal.aborted) return;

        if (!res.ok) {
          // Transient: keep polling unless we've exceeded the max window.
          if (Date.now() - (startedAt ?? 0) > POLL_MAX_DURATION_MS) {
            setErrorMessage("응답을 받지 못했습니다. 나중에 다시 시도해주세요.");
            setStep("failed");
            return;
          }
          timer = setTimeout(poll, POLL_INTERVAL_MS);
          return;
        }

        const json = (await res.json()) as {
          data: {
            status: JobStatus;
            output: JobOutput | null;
            errorMessage: string | null;
          };
        };
        const data = json.data;

        setJobStatus(data.status);

        if (data.status === "COMPLETED") {
          setJobOutput(data.output ?? null);
          setStep("done");
          return;
        }
        if (data.status === "FAILED") {
          setErrorMessage(data.errorMessage ?? "생성 중 오류가 발생했습니다");
          setStep("failed");
          return;
        }

        // RUNNING / QUEUED — keep polling
        if (Date.now() - (startedAt ?? 0) > POLL_MAX_DURATION_MS) {
          setErrorMessage("시간이 초과되었습니다. AI 작업 탭에서 결과를 확인해주세요.");
          setStep("failed");
          return;
        }
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        // Network hiccup — retry a few seconds later unless the window elapsed.
        if (Date.now() - (startedAt ?? 0) > POLL_MAX_DURATION_MS) {
          setErrorMessage(
            err instanceof Error ? err.message : "네트워크 오류가 발생했습니다"
          );
          setStep("failed");
          return;
        }
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    void poll();

    return () => {
      ctrl.abort();
      if (timer) clearTimeout(timer);
      if (elapsedTimer) clearInterval(elapsedTimer);
    };
  }, [step, jobId, startedAt]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  function handleRetry() {
    abortRef.current?.abort();
    setJobId(null);
    setJobStatus("QUEUED");
    setJobOutput(null);
    setErrorMessage(null);
    setStartedAt(null);
    setElapsedMs(0);
    setStep("configure");
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current && step !== "progress") {
      onClose();
    }
  }

  function toggleSection(id: string) {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const allIds = WIZARD_SECTIONS.map((s) => s.id);
    if (selectedSections.size === allIds.length) {
      // All selected → reset to required only.
      setSelectedSections(
        new Set(WIZARD_SECTIONS.filter((s) => s.required).map((s) => s.id))
      );
    } else {
      setSelectedSections(new Set(allIds));
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const progress = describeProgress(jobStatus, engine, elapsedMs);
  const allSelected = selectedSections.size === WIZARD_SECTIONS.length;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bp-wizard-title"
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        className="w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg outline-none max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 id="bp-wizard-title" className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            사업계획서 생성
          </h2>
          {step !== "progress" && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground"
              aria-label="닫기"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {step === "configure" && (
          <div className="space-y-5">
            {/* Sections */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">섹션 선택</h3>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs text-primary hover:underline"
                >
                  {allSelected ? "필수만 선택" : "전체 선택"}
                </button>
              </div>
              <ul className="grid grid-cols-2 gap-2">
                {WIZARD_SECTIONS.map((section) => {
                  const checked = selectedSections.has(section.id);
                  return (
                    <li key={section.id}>
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <Checkbox
                          checked={checked}
                          disabled={section.required}
                          onCheckedChange={() => toggleSection(section.id)}
                          aria-label={section.label}
                        />
                        <span>
                          {section.label}
                          {section.required && (
                            <span className="ml-1 text-[10px] text-muted-foreground">(필수)</span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Engine */}
            <section className="space-y-2" role="radiogroup" aria-label="엔진 선택">
              <h3 className="text-sm font-medium">엔진 선택</h3>
              <div className="grid grid-cols-3 gap-2">
                {(["rag", "precision", "both"] as Engine[]).map((e) => (
                  <label
                    key={e}
                    className={[
                      "flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm transition-colors",
                      engine === e
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-input hover:bg-muted/50",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="engine"
                      value={e}
                      checked={engine === e}
                      onChange={() => setEngine(e)}
                      className="sr-only"
                    />
                    {e === "rag" && "RAG 초안"}
                    {e === "precision" && "정밀 편집"}
                    {e === "both" && "전체 (권장)"}
                  </label>
                ))}
              </div>
            </section>

            {/* Program */}
            <section className="space-y-2">
              <h3 className="text-sm font-medium">
                프로그램 {linkedProgram ? "(연결됨)" : "(선택)"}
              </h3>
              {linkedProgram ? (
                <p className="text-sm text-muted-foreground">
                  이 프로젝트는 <span className="font-medium text-foreground">{linkedProgram.name}</span>에 연결되어 있습니다.
                </p>
              ) : availablePrograms && availablePrograms.length > 0 ? (
                <select
                  value={programId}
                  onChange={(e) => setProgramId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-label="프로그램 선택"
                >
                  <option value="">— 프로그램 선택 —</option>
                  {availablePrograms.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.agency ? ` (${p.agency})` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-muted-foreground">
                  선택 가능한 프로그램이 없습니다. 프로젝트를 편집해 프로그램을 연결해주세요.
                </p>
              )}
            </section>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                취소
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={
                  submitting ||
                  (!linkedProgram && !programId && (!availablePrograms || availablePrograms.length === 0))
                }
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    시작하는 중…
                  </>
                ) : (
                  "생성 시작"
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "progress" && (
          <div className="space-y-5" aria-live="polite">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-medium">{progress.label}</p>
                <p className="text-xs text-muted-foreground">
                  경과 시간 {Math.floor(elapsedMs / 1_000)}초 · 최대 10분까지 소요될 수 있습니다
                </p>
              </div>
            </div>

            <div
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={progress.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="사업계획서 생성 진행률"
            >
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progress.percent}%` }}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              이 창을 닫아도 백그라운드에서 계속 생성됩니다. 결과는 &ldquo;AI 작업&rdquo; 탭에서도 확인할 수 있습니다.
            </p>

            <div className="flex justify-end border-t pt-3">
              <Button type="button" variant="outline" onClick={onClose}>
                백그라운드로 전환
              </Button>
            </div>
          </div>
        )}

        {step === "done" && jobOutput && (
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" aria-hidden="true" />
              <div>
                <p className="text-base font-semibold">문서 생성이 완료되었습니다</p>
                <p className="text-xs text-muted-foreground">
                  DOCX를 내려받거나 문서 상세 페이지에서 확인할 수 있습니다.
                </p>
              </div>
            </div>

            {jobOutput.verification && (
              <VerificationSummary result={jobOutput.verification} />
            )}

            <div className="flex flex-wrap gap-2 border-t pt-3">
              {jobOutput.docxUrl && (
                <Button asChild size="sm">
                  <a href={jobOutput.docxUrl} download>
                    <FileDown className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    DOCX 다운로드
                  </a>
                </Button>
              )}
              {jobOutput.documentId && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/documents/${jobOutput.documentId}`}>
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    문서 열기
                  </Link>
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRetry}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                다시 생성
              </Button>
              <div className="ml-auto">
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                  닫기
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "failed" && (
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 shrink-0 text-destructive" aria-hidden="true" />
              <div>
                <p className="text-base font-semibold">생성에 실패했습니다</p>
                <p className="text-xs text-muted-foreground">
                  {errorMessage ?? "잠시 후 다시 시도해주세요."}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <Button type="button" variant="outline" onClick={onClose}>
                닫기
              </Button>
              <Button type="button" onClick={handleRetry}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                다시 시도
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VerificationSummary
// ---------------------------------------------------------------------------

function VerificationSummary({ result }: { result: VerificationResult }) {
  const { grade, tone } = gradeFromScore(result.score);
  const toneClasses =
    tone === "success"
      ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400"
      : tone === "warning"
        ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
        : "border-destructive/40 bg-destructive/10 text-destructive";

  const errorCount = result.issues?.filter((i) => i.severity === "error").length ?? 0;
  const warningCount = result.issues?.filter((i) => i.severity === "warning").length ?? 0;

  return (
    <div className={`rounded-md border p-3 ${toneClasses}`}>
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-current text-lg font-bold">
          {grade}
        </span>
        <div className="text-sm">
          <p className="font-medium">
            자가 평가 점수 {result.score}점 · {result.passed ? "통과" : "보완 필요"}
          </p>
          <p className="text-xs opacity-80">
            오류 {errorCount}건 · 경고 {warningCount}건
          </p>
        </div>
      </div>
    </div>
  );
}
