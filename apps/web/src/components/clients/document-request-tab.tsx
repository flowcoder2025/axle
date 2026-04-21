"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from "@axle/ui";
import { FileText, Link as LinkIcon, Send } from "lucide-react";
import {
  PortalTokenDialog,
  type PortalTokenCreated,
} from "../portal/portal-token-dialog";

// ---------------------------------------------------------------------------
// Types (mirrors API response of /api/clients/[clientId]/checklist)
// ---------------------------------------------------------------------------
interface ChecklistRow {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  isRequired: boolean;
  itemType: "DOCUMENT" | "CERTIFICATE";
  status: "PENDING" | "REQUESTED" | "UPLOADED" | "VERIFIED";
  requestedAt: string | null;
  uploadedAt: string | null;
  certificateType: string | null;
  project: { id: string; title: string; type: string };
}

interface DocumentRequestTabProps {
  clientId: string;
}

const STATUS_BUCKETS = [
  { id: "PENDING", label: "대기", variant: "secondary" as const },
  { id: "REQUESTED", label: "요청됨", variant: "outline" as const },
  { id: "UPLOADED", label: "업로드됨", variant: "default" as const },
  { id: "VERIFIED", label: "승인됨", variant: "default" as const },
] as const;

type StatusId = (typeof STATUS_BUCKETS)[number]["id"];

// ---------------------------------------------------------------------------
// Category filter — best-effort derivation from certificateType / name
// ---------------------------------------------------------------------------
type CategoryKey = "all" | "certificate" | "business" | "financial" | "other";

const CATEGORY_OPTIONS: Array<{ key: CategoryKey; label: string }> = [
  { key: "all", label: "전체" },
  { key: "certificate", label: "인증서" },
  { key: "business", label: "사업자증명" },
  { key: "financial", label: "재무" },
  { key: "other", label: "기타" },
];

function categoryOf(row: ChecklistRow): CategoryKey {
  const haystack = `${row.name} ${row.certificateType ?? ""}`.toLowerCase();
  if (row.itemType === "CERTIFICATE" || /(벤처|이노비즈|메인비즈|인증서|certif)/.test(haystack)) {
    return "certificate";
  }
  if (/(사업자|등록증|business)/.test(haystack)) {
    return "business";
  }
  if (/(재무|결산|세무|매출|손익|재무제표|financial)/.test(haystack)) {
    return "financial";
  }
  return "other";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function DocumentRequestTab({ clientId }: DocumentRequestTabProps) {
  const [items, setItems] = useState<ChecklistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryKey>("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lastToken, setLastToken] = useState<PortalTokenCreated | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/checklist`);
      if (!res.ok) throw new Error("체크리스트를 불러오지 못했습니다");
      const json = await res.json();
      setItems(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const filteredItems = useMemo(() => {
    if (category === "all") return items;
    return items.filter((it) => categoryOf(it) === category);
  }, [items, category]);

  const buckets = useMemo(() => {
    const map = new Map<StatusId, ChecklistRow[]>();
    for (const bucket of STATUS_BUCKETS) map.set(bucket.id, []);
    for (const item of filteredItems) {
      map.get(item.status as StatusId)?.push(item);
    }
    return map;
  }, [filteredItems]);

  const handleRequest = useCallback(
    async (row: ChecklistRow) => {
      if (row.status !== "PENDING") return;
      setPendingId(row.id);
      try {
        const res = await fetch(
          `/api/projects/${row.projectId}/checklist/${row.id}`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status: "REQUESTED" }),
          },
        );
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(
            detail?.error?.message ?? "요청 이메일 발송에 실패했습니다",
          );
        }
        toast.success("요청이 전송되었습니다");
        await fetchItems();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "오류가 발생했습니다");
      } finally {
        setPendingId(null);
      }
    },
    [fetchItems],
  );

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setCategory(opt.key)}
              data-testid={`doc-category-${opt.key}`}
              className={[
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                category === opt.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setDialogOpen(true)}
          data-testid="portal-token-open"
        >
          <LinkIcon className="mr-1.5 h-3.5 w-3.5" />
          포털 링크 생성
        </Button>
      </div>

      {lastToken && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
          최근 생성된 포털 링크:
          <code className="ml-2 rounded bg-background px-1.5 py-0.5">
            /portal/{lastToken.token}
          </code>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          불러오는 중...
        </div>
      ) : error ? (
        <div className="space-y-2">
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
          <button
            type="button"
            onClick={fetchItems}
            className="text-sm text-primary hover:underline"
          >
            다시 시도
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <FileText className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            등록된 체크리스트 항목이 없습니다.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {STATUS_BUCKETS.map((bucket) => {
            const rows = buckets.get(bucket.id) ?? [];
            if (rows.length === 0) return null;
            return (
              <section
                key={bucket.id}
                data-testid={`doc-bucket-${bucket.id}`}
                className="space-y-2"
              >
                <header className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{bucket.label}</h3>
                  <Badge variant={bucket.variant}>{rows.length}</Badge>
                </header>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>항목</TableHead>
                      <TableHead>프로젝트</TableHead>
                      <TableHead>종류</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="text-right">액션</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">
                          {row.name}
                          {row.isRequired && (
                            <span className="ml-1 text-xs text-destructive">
                              *
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <Link
                            href={`/projects/${row.projectId}`}
                            className="hover:text-primary hover:underline"
                          >
                            {row.project.title}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline">
                            {row.itemType === "CERTIFICATE" ? "인증서" : "서류"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={bucket.variant}>{bucket.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {row.status === "PENDING" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRequest(row)}
                              disabled={pendingId === row.id}
                              data-testid={`doc-request-${row.id}`}
                            >
                              <Send className="mr-1 h-3 w-3" />
                              {pendingId === row.id
                                ? "발송 중..."
                                : "요청 이메일 발송"}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {row.requestedAt
                                ? new Date(row.requestedAt).toLocaleDateString(
                                    "ko-KR",
                                  )
                                : "-"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>
            );
          })}
        </div>
      )}

      <PortalTokenDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        target={{ clientId }}
        onCreated={setLastToken}
      />
    </div>
  );
}
