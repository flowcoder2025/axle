"use client";

/**
 * WI-311 — RESEARCH_INSTITUTE 프로젝트 헤더에 노출되는 "연구소 설립신고서" 버튼.
 *
 * 흐름:
 *   1. 클릭 → GET /api/projects/[projectId]/research-institute-notification
 *      로 미리보기 데이터 로드
 *   2. 다이얼로그에 자동 채워질 항목 + 연구소/R&D slice 입력 현황 표시
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
    instituteName?: string;
    instituteAddress?: string;
    instituteAreaSqm?: number;
    instituteFoundedDate?: string;
  };
  overview?: string;
  rdFields?: Array<{ title: string; items: string[] }>;
  coreTechnologies?: Array<{ name: string; descriptions: string[] }>;
  projects?: Array<{ name: string; content: string; budget?: number }>;
  researchers?: Array<{ name: string; position?: string; degree?: string; specialty?: string }>;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

const NF = new Intl.NumberFormat("ko-KR");
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

export function ResearchInstituteNotificationButton({ projectId }: Props) {
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
        `/api/projects/${projectId}/research-institute-notification`,
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
      // Invalidate cache on close so reopening refetches after edits elsewhere.
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
        `/api/projects/${projectId}/research-institute-notification`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
        throw new Error(body?.error?.message ?? `생성 실패 (${res.status})`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const fileName = utf8Match
        ? decodeURIComponent(utf8Match[1])
        : "연구소설립신고서.docx";

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
        <Button
          variant="default"
          size="sm"
          data-testid="research-institute-notification-button"
        >
          <FileText className="mr-1.5 h-3.5 w-3.5" />
          연구소 설립신고서
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <DialogTitle>연구소 설립신고서 생성 (KOITA)</DialogTitle>
              <DialogDescription>
                고객사 기본 정보는 자동으로 채워집니다. 연구소 명칭·면적·R&D
                분야·과제·연구원은 고객사 상세의 연구소 탭에서 먼저 입력하세요.
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
              data-testid="research-institute-notification-refresh"
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
            <span data-testid="research-institute-notification-error">{error}</span>
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
              </dl>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                연구소 정보
              </h3>
              <dl className="grid grid-cols-[140px_1fr] gap-y-1.5">
                <dt className="text-muted-foreground">연구소 명칭</dt>
                <dd className="flex items-center gap-2">
                  {preview.companyInfo.instituteName ?? "—"}
                  <StatusBadge filled={!!preview.companyInfo.instituteName} />
                </dd>
                <dt className="text-muted-foreground">연구소 소재지</dt>
                <dd>{preview.companyInfo.instituteAddress ?? "—"}</dd>
                <dt className="text-muted-foreground">연구소 설립일</dt>
                <dd>{preview.companyInfo.instituteFoundedDate ?? "—"}</dd>
                <dt className="text-muted-foreground">전용 면적</dt>
                <dd>
                  {preview.companyInfo.instituteAreaSqm != null
                    ? `${numOrDash(preview.companyInfo.instituteAreaSqm)} ㎡`
                    : "—"}
                </dd>
              </dl>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                본문 slice 입력 현황
              </h3>
              <dl className="grid grid-cols-[140px_1fr] gap-y-1.5">
                <dt className="text-muted-foreground">연구소 개요</dt>
                <dd>
                  <StatusBadge filled={!!preview.overview?.trim()} />
                </dd>
                <dt className="text-muted-foreground">R&D 분야</dt>
                <dd>
                  {preview.rdFields && preview.rdFields.length > 0
                    ? `${preview.rdFields.length}개 카테고리`
                    : "—"}
                </dd>
                <dt className="text-muted-foreground">핵심 보유 기술</dt>
                <dd>
                  {preview.coreTechnologies && preview.coreTechnologies.length > 0
                    ? `${preview.coreTechnologies.length}개 기술`
                    : "—"}
                </dd>
                <dt className="text-muted-foreground">연구개발 과제</dt>
                <dd>
                  {preview.projects && preview.projects.length > 0
                    ? `${preview.projects.length}건`
                    : "—"}
                </dd>
                <dt className="text-muted-foreground">연구원</dt>
                <dd>
                  {preview.researchers && preview.researchers.length > 0
                    ? `${preview.researchers.length}명`
                    : "—"}
                </dd>
              </dl>
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
            data-testid="research-institute-notification-download"
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
