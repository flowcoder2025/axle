"use client";

import { useState } from "react";
import { Button, Badge, Input, Label } from "@axle/ui";
import { Plus, Trash2, FolderKanban } from "lucide-react";

type ActionStatus = "OPEN" | "IN_PROGRESS" | "DONE";

export interface ActionItem {
  id: string;
  description: string;
  status: ActionStatus;
  dueDate: string | null;
  assigneeUserId: string | null;
  assigneeContactId: string | null;
  linkedChecklistId: string | null;
}

interface ActionItemListProps {
  meetingId: string;
  actionItems: ActionItem[];
  clientId: string;
  onChanged?: () => void;
}

const STATUS_ORDER: ActionStatus[] = ["OPEN", "IN_PROGRESS", "DONE"];
const STATUS_LABEL: Record<ActionStatus, string> = {
  OPEN: "대기",
  IN_PROGRESS: "진행 중",
  DONE: "완료",
};
const STATUS_VARIANT: Record<ActionStatus, "outline" | "secondary" | "default"> = {
  OPEN: "outline",
  IN_PROGRESS: "secondary",
  DONE: "default",
};

function nextStatus(current: ActionStatus): ActionStatus {
  const idx = STATUS_ORDER.indexOf(current);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

const selectCn =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function ActionItemList({
  meetingId,
  actionItems: initial,
  clientId,
  onChanged,
}: ActionItemListProps) {
  const [items, setItems] = useState<ActionItem[]>(initial);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [adding, setAdding] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creatingProjectId, setCreatingProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newDescription.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: newDescription.trim(),
          dueDate: newDueDate ? new Date(newDueDate).toISOString() : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "액션 아이템 추가에 실패했습니다.");
        return;
      }
      setItems((prev) => [...prev, { ...json.data, dueDate: json.data.dueDate ?? null }]);
      setNewDescription("");
      setNewDueDate("");
      setShowAddForm(false);
      onChanged?.();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setAdding(false);
    }
  }

  async function handleToggleStatus(item: ActionItem) {
    const next = nextStatus(item.status);
    setTogglingId(item.id);
    setError(null);
    try {
      const res = await fetch(
        `/api/meetings/${meetingId}/actions/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "상태 변경에 실패했습니다.");
        return;
      }
      setItems((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, status: next } : a))
      );
      onChanged?.();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(itemId: string) {
    setDeletingId(itemId);
    setError(null);
    try {
      const res = await fetch(
        `/api/meetings/${meetingId}/actions/${itemId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const json = await res.json();
        setError(json?.error?.message ?? "삭제에 실패했습니다.");
        return;
      }
      setItems((prev) => prev.filter((a) => a.id !== itemId));
      onChanged?.();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreateProject(item: ActionItem) {
    const projectType = window.prompt(
      "프로젝트 유형을 입력하세요\n(BUSINESS_PLAN / VENTURE_CERT / SOBOOJANG_CERT / RESEARCH_INSTITUTE / PATENT / FINANCIAL_ANALYSIS / RESEARCH_TASK / BUNDLE)",
      "BUSINESS_PLAN"
    );
    if (!projectType) return;
    setCreatingProjectId(item.id);
    setError(null);
    try {
      const res = await fetch(
        `/api/meetings/${meetingId}/actions/${item.id}/create-project`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectType, clientId }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "프로젝트 생성에 실패했습니다.");
        return;
      }
      alert(`프로젝트가 생성되었습니다: ${json.data.title}`);
      onChanged?.();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setCreatingProjectId(null);
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {items.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          액션 아이템이 없습니다.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm">{item.description}</p>
                {item.dueDate && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    마감: {formatDate(item.dueDate)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleStatus(item)}
                  disabled={togglingId === item.id}
                  className="focus:outline-none"
                  aria-label="상태 변경"
                >
                  <Badge variant={STATUS_VARIANT[item.status]}>
                    {STATUS_LABEL[item.status]}
                  </Badge>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCreateProject(item)}
                  disabled={creatingProjectId === item.id}
                  title="프로젝트 생성"
                >
                  <FolderKanban className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                  aria-label="삭제"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showAddForm ? (
        <form
          onSubmit={handleAdd}
          className="rounded-lg border p-4 space-y-3"
        >
          <h3 className="text-sm font-medium">액션 아이템 추가</h3>
          <div className="space-y-1.5">
            <Label htmlFor="action-description">
              내용 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="action-description"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="예: 제안서 초안 작성"
              disabled={adding}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="action-due-date">마감일</Label>
            <input
              id="action-due-date"
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              disabled={adding}
              className={selectCn}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={adding || !newDescription.trim()}
            >
              {adding ? "추가 중..." : "추가"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddForm(false);
                setNewDescription("");
                setNewDueDate("");
              }}
              disabled={adding}
            >
              취소
            </Button>
          </div>
        </form>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          액션 아이템 추가
        </Button>
      )}
    </div>
  );
}
