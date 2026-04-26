"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from "@axle/ui";
import { Bot, Download, Plus, RefreshCw } from "lucide-react";

type PortalKind = "HOMETAX" | "MINWON24" | "INSURANCE";
type CredentialsKind = "CERTIFICATE" | "USERPW";
type ScraperJobType = "HOMETAX_ISSUE" | "MINWON24_ISSUE" | "INSURANCE_ISSUE";
type ScraperJobStatus =
  | "QUEUED"
  | "PICKED_UP"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED";

interface ScraperJobRow {
  id: string;
  clientId: string;
  type: ScraperJobType;
  target: string;
  status: ScraperJobStatus;
  credentialsKind: CredentialsKind;
  credentialsRef: string;
  createdAt: string;
  completedAt: string | null;
  automationLogId: string | null;
  automationLog: {
    id: string;
    resultUrl: string | null;
    errorMessage: string | null;
  } | null;
}

interface CertificateOption {
  id: string;
  subject: string;
  validTo: string;
}

interface AccountOption {
  id: string;
  portal: PortalKind;
  userId: string;
}

interface PortalCredentialsResponse {
  data: {
    certificates: CertificateOption[];
    accounts: AccountOption[];
  };
}

interface ScraperJobsTabProps {
  clientId: string;
}

const JOB_TYPE_LABELS: Record<ScraperJobType, string> = {
  HOMETAX_ISSUE: "홈택스 발급",
  MINWON24_ISSUE: "정부24 발급",
  INSURANCE_ISSUE: "4대보험 발급",
};

const STATUS_LABELS: Record<
  ScraperJobStatus,
  { label: string; variant: "secondary" | "outline" | "default" | "destructive" }
> = {
  QUEUED: { label: "대기", variant: "secondary" },
  PICKED_UP: { label: "할당됨", variant: "outline" },
  RUNNING: { label: "실행 중", variant: "outline" },
  COMPLETED: { label: "완료", variant: "default" },
  FAILED: { label: "실패", variant: "destructive" },
  EXPIRED: { label: "만료", variant: "destructive" },
  CANCELLED: { label: "취소", variant: "secondary" },
};

const TYPE_TO_PORTAL: Record<ScraperJobType, PortalKind> = {
  HOMETAX_ISSUE: "HOMETAX",
  MINWON24_ISSUE: "MINWON24",
  INSURANCE_ISSUE: "INSURANCE",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR");
}

export function ScraperJobsTab({ clientId }: ScraperJobsTabProps) {
  const [jobs, setJobs] = useState<ScraperJobRow[]>([]);
  const [certificates, setCertificates] = useState<CertificateOption[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [type, setType] = useState<ScraperJobType>("HOMETAX_ISSUE");
  const [target, setTarget] = useState("납세증명서");
  const [credentialsKind, setCredentialsKind] = useState<CredentialsKind>(
    "CERTIFICATE",
  );
  const [credentialsRef, setCredentialsRef] = useState("");

  const portalForType = TYPE_TO_PORTAL[type];

  const accountOptions = useMemo(
    () => accounts.filter((a) => a.portal === portalForType),
    [accounts, portalForType],
  );

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch(`/api/scraper/jobs?clientId=${clientId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data: ScraperJobRow[] };
      setJobs(json.data);
    } catch (err) {
      toast.error("작업 목록을 불러오지 못했습니다");
      console.error(err);
    }
  }, [clientId]);

  const fetchCredentials = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/clients/${clientId}/portal-credentials`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as PortalCredentialsResponse;
      setCertificates(json.data.certificates);
      setAccounts(json.data.accounts);
    } catch (err) {
      console.error(err);
    }
  }, [clientId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchJobs(), fetchCredentials()]);
    setLoading(false);
  }, [fetchJobs, fetchCredentials]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Reset credentialsRef when relevant inputs change so we never submit stale ID
  useEffect(() => {
    setCredentialsRef("");
  }, [type, credentialsKind]);

  const handleSubmit = async () => {
    if (!target.trim()) {
      toast.error("발급할 서류명을 입력하세요");
      return;
    }
    if (!credentialsRef) {
      toast.error("자격증명을 선택하세요");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/scraper/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          type,
          target: target.trim(),
          credentialsKind,
          credentialsRef,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
      }
      toast.success("작업을 등록했습니다");
      await fetchJobs();
    } catch (err) {
      toast.error(`등록 실패: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="scraper-jobs-tab">
      <div className="flex items-center gap-2">
        <Bot className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">포털 자동화 작업</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        등록된 자격증명을 사용해 외부 포털에서 서류를 자동 발급합니다. 결과 PDF는
        완료 후 다운로드할 수 있습니다.
      </p>

      {/* Create form */}
      <div
        data-testid="scraper-job-create-form"
        className="rounded-lg border bg-muted/30 p-4 space-y-3"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="job-type">작업 종류</Label>
            <select
              id="job-type"
              data-testid="job-type-select"
              value={type}
              onChange={(e) => setType(e.target.value as ScraperJobType)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              {(Object.keys(JOB_TYPE_LABELS) as ScraperJobType[]).map((k) => (
                <option key={k} value={k}>
                  {JOB_TYPE_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="job-target">서류명</Label>
            <Input
              id="job-target"
              data-testid="job-target-input"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="예: 납세증명서"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="creds-kind">자격증명 종류</Label>
            <select
              id="creds-kind"
              data-testid="creds-kind-select"
              value={credentialsKind}
              onChange={(e) =>
                setCredentialsKind(e.target.value as CredentialsKind)
              }
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="CERTIFICATE">공인인증서 (PFX)</option>
              <option value="USERPW">아이디/비밀번호</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="creds-ref">자격증명 선택</Label>
            <select
              id="creds-ref"
              data-testid="creds-ref-select"
              value={credentialsRef}
              onChange={(e) => setCredentialsRef(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">선택하세요</option>
              {credentialsKind === "CERTIFICATE"
                ? certificates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.subject}
                    </option>
                  ))
                : accountOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.userId} ({a.portal})
                    </option>
                  ))}
            </select>
            {credentialsKind === "CERTIFICATE" && certificates.length === 0 && (
              <p className="text-xs text-amber-600">
                등록된 인증서가 없습니다. 상단의 &quot;포털 자격증명&quot; 탭에서 먼저 등록하세요.
              </p>
            )}
            {credentialsKind === "USERPW" && accountOptions.length === 0 && (
              <p className="text-xs text-amber-600">
                해당 포털에 등록된 계정이 없습니다.
              </p>
            )}
          </div>
        </div>
        <Button
          data-testid="create-job-btn"
          onClick={handleSubmit}
          disabled={submitting || !target || !credentialsRef}
        >
          <Plus className="mr-2 h-4 w-4" />
          {submitting ? "등록 중..." : "작업 등록"}
        </Button>
      </div>

      {/* Job list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">최근 작업</h3>
          <Button
            data-testid="refresh-jobs-btn"
            variant="ghost"
            size="sm"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            새로고침
          </Button>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>종류</TableHead>
                <TableHead>서류</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>등록</TableHead>
                <TableHead>완료</TableHead>
                <TableHead>결과</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    불러오는 중...
                  </TableCell>
                </TableRow>
              ) : jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    등록된 작업이 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((job) => {
                  const status = STATUS_LABELS[job.status];
                  const url = job.automationLog?.resultUrl;
                  return (
                    <TableRow key={job.id} data-testid={`scraper-job-row-${job.id}`}>
                      <TableCell>{JOB_TYPE_LABELS[job.type]}</TableCell>
                      <TableCell className="font-medium">{job.target}</TableCell>
                      <TableCell>
                        <Badge
                          variant={status.variant}
                          data-testid={`job-status-${job.id}`}
                        >
                          {status.label}
                        </Badge>
                        {job.automationLog?.errorMessage && (
                          <span
                            className="ml-2 text-xs text-rose-600"
                            data-testid={`job-error-${job.id}`}
                          >
                            {job.automationLog.errorMessage}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(job.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(job.completedAt)}
                      </TableCell>
                      <TableCell>
                        {url ? (
                          <a
                            data-testid={`download-result-${job.id}`}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-primary hover:underline"
                          >
                            <Download className="mr-1 h-4 w-4" />
                            PDF
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
