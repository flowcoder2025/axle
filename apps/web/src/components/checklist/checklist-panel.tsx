"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@axle/ui";
import { Check, Clock, FilePlus, Loader2, Plus, Trash2, Upload } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DocStatus = "PENDING" | "REQUESTED" | "UPLOADED" | "VERIFIED";

interface ChecklistDocument {
  id: string;
  name: string;
  fileUrl: string;
}

interface ChecklistItem {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  isRequired: boolean;
  status: DocStatus;
  requestedAt: string | null;
  uploadedAt: string | null;
  documentId: string | null;
  document: ChecklistDocument | null;
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  DocStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  PENDING: { label: "대기", variant: "outline" },
  REQUESTED: { label: "요청됨", variant: "secondary" },
  UPLOADED: { label: "업로드됨", variant: "default" },
  VERIFIED: { label: "확인완료", variant: "default" },
};

function StatusBadge({ status }: { status: DocStatus }) {
  const cfg = STATUS_CONFIG[status];
  const isVerified = status === "VERIFIED";
  return (
    <Badge
      variant={cfg.variant}
      className={isVerified ? "bg-green-100 text-green-800 hover:bg-green-100" : undefined}
    >
      {isVerified && <Check className="mr-1 h-3 w-3" />}
      {cfg.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Add-item dialog
// ---------------------------------------------------------------------------

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, description: string, isRequired: boolean) => Promise<void>;
}

function AddItemDialog({ open, onOpenChange, onSubmit }: AddItemDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isRequired, setIsRequired] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName("");
      setDescription("");
      setIsRequired(true);
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("항목명은 필수입니다.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(name.trim(), description.trim(), isRequired);
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "항목 추가에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>체크리스트 항목 추가</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="item-name">항목명 *</Label>
            <Input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 사업자등록증"
              disabled={submitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-description">설명 (선택)</Label>
            <Input
              id="item-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="추가 안내사항"
              disabled={submitting}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="item-required"
              type="checkbox"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              disabled={submitting}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="item-required" className="cursor-pointer font-normal">
              필수 항목
            </Label>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              취소
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              추가
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ChecklistPanelProps {
  projectId: string;
  /** clientId is required to generate upload tokens */
  clientId: string;
}

export function ChecklistPanel({ projectId, clientId }: ChecklistPanelProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Action-level state: maps itemId → loading state
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  // Maps itemId → upload token (populated after POST /api/upload/tokens succeeds)
  const [uploadTokens, setUploadTokens] = useState<Record<string, string>>({});

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/checklist`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: { message?: string } }).error?.message ??
            "체크리스트를 불러오지 못했습니다.",
        );
      }
      const json = await res.json();
      setItems((json as { data: ChecklistItem[] }).data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function setItemLoading(itemId: string, isLoading: boolean) {
    setActionLoading((prev) => ({ ...prev, [itemId]: isLoading }));
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleAddItem(name: string, description: string, isRequired: boolean) {
    const res = await fetch(`/api/projects/${projectId}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: description || undefined, isRequired }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(
        (json as { error?: { message?: string } }).error?.message ?? "항목 추가에 실패했습니다.",
      );
    }
    await fetchItems();
  }

  async function handleRequest(item: ChecklistItem) {
    setItemLoading(item.id, true);
    setActionError(null);
    try {
      const res = await fetch("/api/upload/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklistItemId: item.id, clientId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: { message?: string } }).error?.message ?? "요청에 실패했습니다.",
        );
      }
      const json = await res.json();
      const token = (json as { data?: { token?: string } }).data?.token;
      if (token) {
        setUploadTokens((prev) => ({ ...prev, [item.id]: token }));
      }
      await fetchItems();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "요청에 실패했습니다.");
    } finally {
      setItemLoading(item.id, false);
    }
  }

  async function handleVerify(item: ChecklistItem) {
    setItemLoading(item.id, true);
    setActionError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/checklist/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "VERIFIED" }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: { message?: string } }).error?.message ?? "확인에 실패했습니다.",
        );
      }
      await fetchItems();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "확인에 실패했습니다.");
    } finally {
      setItemLoading(item.id, false);
    }
  }

  async function handleDelete(item: ChecklistItem) {
    if (!confirm(`"${item.name}" 항목을 삭제하시겠습니까?`)) return;

    setItemLoading(item.id, true);
    setActionError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/checklist/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: { message?: string } }).error?.message ?? "삭제에 실패했습니다.",
        );
      }
      await fetchItems();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    } finally {
      setItemLoading(item.id, false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderItemAction(item: ChecklistItem) {
    const busy = actionLoading[item.id] ?? false;
    const uploadToken = uploadTokens[item.id];

    switch (item.status) {
      case "PENDING":
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleRequest(item)}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-3.5 w-3.5" />
            )}
            요청
          </Button>
        );

      case "REQUESTED":
        return (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>대기중</span>
            {uploadToken && (
              <a
                href={`/api/upload/${uploadToken}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 underline underline-offset-2 hover:text-foreground"
              >
                업로드 링크
              </a>
            )}
          </div>
        );

      case "UPLOADED":
        return (
          <Button
            size="sm"
            onClick={() => handleVerify(item)}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="mr-1.5 h-3.5 w-3.5" />
            )}
            확인
          </Button>
        );

      case "VERIFIED":
        return (
          <div className="flex items-center gap-1 text-sm text-green-700">
            <Check className="h-4 w-4" />
            <span className="sr-only">확인완료</span>
          </div>
        );

      default:
        return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">체크리스트</h3>
          {!loading && !error && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              총 {items.length}건 · 필수{" "}
              {items.filter((i) => i.isRequired).length}건
            </p>
          )}
        </div>
        <Button size="sm" onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          항목 추가
        </Button>
      </div>

      {/* Action error */}
      {actionError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {/* Fetch error */}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          불러오는 중...
        </div>
      )}

      {/* Empty */}
      {!loading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <FilePlus className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            등록된 체크리스트 항목이 없습니다.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            첫 항목 추가
          </Button>
        </div>
      )}

      {/* Item list */}
      {!loading && items.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {items.map((item) => {
            const busy = actionLoading[item.id] ?? false;
            return (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{item.name}</span>
                    {item.isRequired && (
                      <Badge variant="outline" className="text-xs">
                        필수
                      </Badge>
                    )}
                    <StatusBadge status={item.status} />
                  </div>
                  {item.description && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                  {item.document && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      서류:{" "}
                      <a
                        href={item.document.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        {item.document.name}
                      </a>
                    </p>
                  )}
                </div>

                {/* Action */}
                <div className="shrink-0">{renderItemAction(item)}</div>

                {/* Delete */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                  title="삭제"
                  onClick={() => handleDelete(item)}
                  disabled={busy}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="sr-only">삭제</span>
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Add-item dialog */}
      <AddItemDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={handleAddItem}
      />
    </div>
  );
}
