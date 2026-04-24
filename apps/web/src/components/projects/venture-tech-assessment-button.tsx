"use client";

/**
 * WI-303 — VENTURE_CERT 프로젝트 헤더에 노출되는 "기술성평가서" 버튼.
 *
 * 흐름:
 *   1. 클릭 → GET /api/projects/[projectId]/venture-tech-assessment 로 미리보기 데이터 로드
 *   2. 다이얼로그에 자동 채워질 항목 + 누락 항목 표시
 *   3. "DOCX 다운로드" → POST 같은 endpoint → blob → <a download> 트리거
 */

import { useCallback, useState } from "react";
import { Button } from "@axle/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@axle/ui";
import { Badge } from "@axle/ui";
import { FileText, Loader2, Download, AlertCircle, RefreshCw } from "lucide-react";

interface PreviewInput {
  companyInfo: {
    companyName: string;
    ceoName: string;
    foundedDate?: string;
    businessNumber?: string;
    address?: string;
    capitalAmount?: number;
  };
  sections: Record<string, string>;
  finance?: Array<{ year: number; revenue?: number }>;
  achievements?: { domesticSales?: number; exports?: number; employeeCount?: number };
  intellectualProperty?: {
    patents?: number;
    trademarks?: number;
    designs?: number;
    softwareCopyrights?: number;
  };
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

const NF = new Intl.NumberFormat("ko-KR");
const moneyOrDash = (n?: number) => (n != null ? `${NF.format(Math.round(n))}원` : "—");
const numOrDash = (n?: number) => (n != null ? NF.format(Math.round(n)) : "—");

function StatusBadge({ filled }: { filled: boolean }) {
  return filled ? (
    <Badge variant="default" className="text-[10px]">
      자동 채움
    </Badge>
  ) : (
    <Badge variant="outline" className="text-[10px] text-muted-foreground">
      미입력
    </Badge>
  );
}

interface Props {
  projectId: string;
}

export function VentureTechAssessmentButton({ projectId }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewInput | null>(null);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/venture-tech-assessment`,
        { method: "GET" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
        throw new Error(body?.error?.message ?? `미리보기 로드 실패 (${res.status})`);
      }
      const body = (await res.json()) as { input: PreviewInput };
      setPreview(body.input);
    } catch (err) {
      setError(err instanceof Error ? err.message : "미리보기 로드 실패");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next && !preview && !loading) {
        void loadPreview();
      }
      // WI-334-feat M3: invalidate cache on close so reopening fetches fresh
      // data after the user edits client info in another tab.
      if (!next) {
        setPreview(null);
        setError(null);
      }
    },
    [preview, loading, loadPreview],
  );

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/venture-tech-assessment`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
        throw new Error(body?.error?.message ?? `생성 실패 (${res.status})`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      // Extract `filename*=UTF-8''<encoded>` from the header (RFC 5987).
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const fileName = utf8Match
        ? decodeURIComponent(utf8Match[1])
        : "기술성평가서.docx";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "다운로드 실패");
    } finally {
      setDownloading(false);
    }
  }, [projectId]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" data-testid="venture-tech-assessment-button">
          <FileText className="mr-1.5 h-3.5 w-3.5" />
          기술성평가서
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <DialogTitle>벤처 기술성평가서 생성</DialogTitle>
              <DialogDescription>
                고객사 정보·재무·실적이 자동으로 채워집니다. 누락된 항목은
                고객사 정보 페이지에서 먼저 입력하세요.
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPreview(null);
                void loadPreview();
              }}
              disabled={loading || downloading}
              data-testid="venture-tech-assessment-refresh"
              aria-label="미리보기 새로고침"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            미리보기 데이터를 불러오는 중...
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span data-testid="venture-tech-assessment-error">{error}</span>
          </div>
        )}

        {preview && !loading && (
          <div className="space-y-4 text-sm">
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                회사 정보
              </h3>
              <dl className="grid grid-cols-[140px_1fr] gap-y-1.5">
                <dt className="text-muted-foreground">회사명</dt>
                <dd className="flex items-center gap-2">
                  {preview.companyInfo.companyName || "—"}
                  <StatusBadge filled={!!preview.companyInfo.companyName} />
                </dd>
                <dt className="text-muted-foreground">대표자</dt>
                <dd className="flex items-center gap-2">
                  {preview.companyInfo.ceoName || "—"}
                  <StatusBadge filled={!!preview.companyInfo.ceoName} />
                </dd>
                <dt className="text-muted-foreground">사업자번호</dt>
                <dd>{preview.companyInfo.businessNumber ?? "—"}</dd>
                <dt className="text-muted-foreground">설립일</dt>
                <dd>{preview.companyInfo.foundedDate ?? "—"}</dd>
                <dt className="text-muted-foreground">소재지</dt>
                <dd>{preview.companyInfo.address ?? "—"}</dd>
                <dt className="text-muted-foreground">자본금</dt>
                <dd>{moneyOrDash(preview.companyInfo.capitalAmount)}</dd>
              </dl>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                재무 (최근 {preview.finance?.length ?? 0}년)
              </h3>
              {preview.finance && preview.finance.length > 0 ? (
                <ul className="space-y-1">
                  {preview.finance.map((row) => (
                    <li
                      key={row.year}
                      className="flex justify-between rounded bg-muted/40 px-2 py-1"
                    >
                      <span>{row.year}년</span>
                      <span className="font-mono">{moneyOrDash(row.revenue)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">
                  재무 데이터가 없습니다. (선택 항목)
                </p>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                실적·인력
              </h3>
              <dl className="grid grid-cols-[140px_1fr] gap-y-1.5">
                <dt className="text-muted-foreground">국내 매출</dt>
                <dd>{moneyOrDash(preview.achievements?.domesticSales)}</dd>
                <dt className="text-muted-foreground">수출액</dt>
                <dd>{moneyOrDash(preview.achievements?.exports)}</dd>
                <dt className="text-muted-foreground">정규직</dt>
                <dd>
                  {preview.achievements?.employeeCount != null
                    ? `${numOrDash(preview.achievements.employeeCount)}명`
                    : "—"}
                </dd>
              </dl>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                지식재산권
              </h3>
              <dl className="grid grid-cols-[140px_1fr] gap-y-1.5">
                <dt className="text-muted-foreground">특허</dt>
                <dd>{numOrDash(preview.intellectualProperty?.patents)}건</dd>
                <dt className="text-muted-foreground">상표</dt>
                <dd>{numOrDash(preview.intellectualProperty?.trademarks)}건</dd>
                <dt className="text-muted-foreground">디자인</dt>
                <dd>{numOrDash(preview.intellectualProperty?.designs)}건</dd>
                <dt className="text-muted-foreground">SW 저작권</dt>
                <dd>{numOrDash(preview.intellectualProperty?.softwareCopyrights)}건</dd>
              </dl>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                9개 섹션 본문
              </h3>
              <p className="text-muted-foreground">
                {Object.keys(preview.sections).length > 0
                  ? `${Object.keys(preview.sections).length}/9 섹션이 입력되어 있습니다.`
                  : "본문이 비어 있습니다. 미작성 섹션은 (미작성) placeholder로 출력됩니다."}
              </p>
            </section>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={downloading}
          >
            닫기
          </Button>
          <Button
            onClick={handleDownload}
            disabled={!preview || loading || downloading}
            data-testid="venture-tech-assessment-download"
          >
            {downloading ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                생성 중...
              </>
            ) : (
              <>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                DOCX 다운로드
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
