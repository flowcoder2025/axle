"use client";

/**
 * ErpCounterparty interactive view (Phase 21 WI-732-feat).
 *
 * Hosts the search box + type filter + table + CRUD/merge dialogs.
 * Permission flags are decided server-side and passed in so the merge
 * button doesn't even render for users lacking `erp:merge` (RED AC #4).
 *
 * Search uses the WI-724a fuzzy endpoint when `q` has 2+ chars; falls
 * back to the server-side list (initialRows) when the box is empty.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@axle/ui";
import type { SerializedErpCounterparty } from "@/lib/erp/serialize";

type FilterType = "ALL" | "CUSTOMER" | "SUPPLIER" | "BOTH";

interface Props {
  initialRows: SerializedErpCounterparty[];
  truncated: boolean;
  initialQuery: string;
  initialType: string;
  canMerge: boolean;
  canWrite: boolean;
}

const TYPE_LABEL: Record<"CUSTOMER" | "SUPPLIER" | "BOTH", string> = {
  CUSTOMER: "고객",
  SUPPLIER: "공급자",
  BOTH: "양방향",
};

export function CounterpartiesView({
  initialRows,
  truncated,
  initialQuery,
  initialType,
  canMerge,
  canWrite,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [query, setQuery] = React.useState(initialQuery);
  const [type, setType] = React.useState<FilterType>(
    (["ALL", "CUSTOMER", "SUPPLIER", "BOTH"] as const).includes(
      initialType as FilterType,
    )
      ? (initialType as FilterType)
      : "ALL",
  );
  const [rows, setRows] = React.useState(initialRows);

  // Dialog state — single shared modal for create + edit.
  const [editTarget, setEditTarget] = React.useState<
    SerializedErpCounterparty | null
  >(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  // Merge confirm dialog
  const [mergeTarget, setMergeTarget] = React.useState<
    SerializedErpCounterparty | null
  >(null);

  // URL-sync submit (server fetches the next set).
  function submitFilter(): void {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (type !== "ALL") params.set("type", type);
    router.push(`/erp/counterparties${params.toString() ? `?${params}` : ""}`);
  }

  // Reflect external row changes (URL navigation) into local state.
  React.useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  return (
    <div className="space-y-4" data-testid="counterparties-view">
      <div
        className="flex flex-wrap items-center gap-3"
        data-testid="toolbar-search"
      >
        <Input
          type="search"
          aria-label="거래처 검색"
          placeholder="거래처명 또는 사업자등록번호 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
          data-testid="counterparty-search-input"
        />
        <select
          aria-label="유형 필터"
          value={type}
          onChange={(e) => setType(e.target.value as FilterType)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          data-testid="counterparty-type-filter"
        >
          <option value="ALL">전체 유형</option>
          <option value="CUSTOMER">고객</option>
          <option value="SUPPLIER">공급자</option>
          <option value="BOTH">양방향</option>
        </select>
        <Button
          type="button"
          onClick={submitFilter}
          data-testid="counterparty-search-submit"
        >
          검색
        </Button>
        <div className="ml-auto flex gap-2">
          {canWrite && (
            <Button
              type="button"
              variant="default"
              onClick={() => setCreateOpen(true)}
              data-testid="counterparty-new-button"
            >
              + 신규 거래처
            </Button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div
          className="rounded border border-dashed p-10 text-center text-sm text-muted-foreground"
          data-testid="counterparty-empty"
        >
          조건에 맞는 거래처가 없습니다.
        </div>
      ) : (
        <table
          className="w-full text-sm"
          data-testid="counterparty-table"
        >
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th className="py-2 pr-3">거래처명</th>
              <th className="py-2 pr-3">사업자등록번호</th>
              <th className="py-2 pr-3">유형</th>
              <th className="py-2 pr-3">기본 계정과목</th>
              <th className="py-2 pr-3">최종 수정</th>
              <th className="py-2 pr-3 text-right">동작</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b last:border-0"
                data-testid={`counterparty-row-${row.id}`}
              >
                <td className="py-2 pr-3 font-medium">{row.name}</td>
                <td className="py-2 pr-3 text-muted-foreground">
                  {row.bizRegNo ?? "—"}
                </td>
                <td className="py-2 pr-3">
                  <span
                    className={typeBadgeClass(row.type)}
                    data-testid={`counterparty-type-${row.id}`}
                  >
                    {TYPE_LABEL[row.type]}
                  </span>
                </td>
                <td className="py-2 pr-3 text-muted-foreground">
                  {row.defaultCoaCode ?? "—"}
                </td>
                <td className="py-2 pr-3 text-muted-foreground">
                  {row.updatedAt?.slice(0, 10) ?? "—"}
                </td>
                <td className="py-2 pr-3">
                  <div className="flex justify-end gap-2">
                    {canWrite && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditTarget(row)}
                        data-testid={`counterparty-edit-${row.id}`}
                      >
                        편집
                      </Button>
                    )}
                    {canMerge && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setMergeTarget(row)}
                        data-testid={`counterparty-merge-${row.id}`}
                      >
                        머지
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {truncated && (
        <p
          className="text-xs text-muted-foreground"
          data-testid="counterparty-truncation"
        >
          상위 200건만 표시되었습니다. 검색어를 좁혀 주세요.
        </p>
      )}

      <CounterpartyFormDialog
        open={createOpen || editTarget !== null}
        mode={editTarget ? "edit" : "create"}
        target={editTarget}
        onClose={(refresh) => {
          setCreateOpen(false);
          setEditTarget(null);
          if (refresh) router.refresh();
        }}
      />

      <MergeConfirmDialog
        target={mergeTarget}
        onClose={(refresh) => {
          setMergeTarget(null);
          if (refresh) router.refresh();
        }}
      />
    </div>
  );
}

function typeBadgeClass(t: "CUSTOMER" | "SUPPLIER" | "BOTH"): string {
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs";
  switch (t) {
    case "CUSTOMER":
      return `${base} bg-blue-100 text-blue-800`;
    case "SUPPLIER":
      return `${base} bg-orange-100 text-orange-800`;
    case "BOTH":
      return `${base} bg-purple-100 text-purple-800`;
  }
}

// ---------------- Form (create + edit) ----------------

interface FormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  target: SerializedErpCounterparty | null;
  onClose: (refresh: boolean) => void;
}

function CounterpartyFormDialog({
  open,
  mode,
  target,
  onClose,
}: FormDialogProps): React.JSX.Element {
  const [name, setName] = React.useState("");
  const [bizRegNo, setBizRegNo] = React.useState("");
  const [type, setType] = React.useState<"CUSTOMER" | "SUPPLIER" | "BOTH">(
    "CUSTOMER",
  );
  const [defaultCoaCode, setDefaultCoaCode] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    if (target) {
      setName(target.name);
      setBizRegNo(target.bizRegNo ?? "");
      setType(target.type);
      setDefaultCoaCode(target.defaultCoaCode ?? "");
    } else {
      setName("");
      setBizRegNo("");
      setType("CUSTOMER");
      setDefaultCoaCode("");
    }
    setError(null);
  }, [open, target]);

  async function submit(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        name,
        bizRegNo: bizRegNo.trim() || null,
        type,
        defaultCoaCode: defaultCoaCode.trim() || null,
      };
      const url =
        mode === "edit" && target
          ? `/api/erp/counterparties/${target.id}`
          : "/api/erp/counterparties";
      const method = mode === "edit" ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = await safeJson(res);
        setError(
          (payload as { error?: { message?: string } } | null)?.error?.message ??
            `요청 실패 (${res.status})`,
        );
        return;
      }
      onClose(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent data-testid="counterparty-form-dialog">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "거래처 편집" : "신규 거래처"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="거래처명">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="counterparty-form-name"
            />
          </Field>
          <Field label="사업자등록번호">
            <Input
              value={bizRegNo}
              onChange={(e) => setBizRegNo(e.target.value)}
              placeholder="123-45-67890"
              data-testid="counterparty-form-bizregno"
            />
          </Field>
          <Field label="유형">
            <select
              value={type}
              onChange={(e) =>
                setType(e.target.value as "CUSTOMER" | "SUPPLIER" | "BOTH")
              }
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              data-testid="counterparty-form-type"
            >
              <option value="CUSTOMER">고객</option>
              <option value="SUPPLIER">공급자</option>
              <option value="BOTH">양방향</option>
            </select>
          </Field>
          <Field label="기본 계정과목">
            <Input
              value={defaultCoaCode}
              onChange={(e) => setDefaultCoaCode(e.target.value)}
              placeholder="예: 401"
              data-testid="counterparty-form-coa"
            />
          </Field>
          {error && (
            <p
              className="text-sm text-destructive"
              data-testid="counterparty-form-error"
            >
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onClose(false)}
            disabled={submitting}
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={submitting || !name.trim()}
            data-testid="counterparty-form-submit"
          >
            {submitting ? "저장 중…" : mode === "edit" ? "저장" : "추가"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-3">
      <label className="text-sm text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

// ---------------- Merge confirm ----------------

interface MergeProps {
  target: SerializedErpCounterparty | null;
  onClose: (refresh: boolean) => void;
}

function MergeConfirmDialog({
  target,
  onClose,
}: MergeProps): React.JSX.Element {
  const [destinationId, setDestinationId] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDestinationId("");
    setError(null);
  }, [target]);

  async function confirm(): Promise<void> {
    if (!target) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/erp/counterparties/${target.id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: destinationId.trim() }),
      });
      if (!res.ok) {
        const payload = await safeJson(res);
        setError(
          (payload as { error?: { message?: string } } | null)?.error?.message ??
            `머지 실패 (${res.status})`,
        );
        return;
      }
      onClose(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog
      open={target !== null}
      onOpenChange={(o) => !o && onClose(false)}
    >
      <AlertDialogContent data-testid="counterparty-merge-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>거래처 머지</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="block mb-2">
              원본 거래처{" "}
              <strong>{target?.name}</strong> 의 모든 주문 이력이 대상 거래처에
              재포인팅됩니다. 머지 후 원본은 soft-delete 처리되며 복구 불가.
            </span>
            <span className="block">대상 거래처 ID를 입력하세요:</span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Input
          value={destinationId}
          onChange={(e) => setDestinationId(e.target.value)}
          placeholder="cp_xxxxx"
          data-testid="counterparty-merge-target-id"
        />
        {error && (
          <p
            className="text-sm text-destructive"
            data-testid="counterparty-merge-error"
          >
            {error}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirm}
            disabled={submitting || !destinationId.trim()}
            data-testid="counterparty-merge-confirm"
          >
            {submitting ? "머지 중…" : "머지 실행"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
