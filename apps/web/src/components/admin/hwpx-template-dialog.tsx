"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  Label,
  toast,
} from "@axle/ui";
import type { HwpxTemplateRow } from "@/app/(admin)/platform-admin/hwpx-templates/templates-table";

const CATEGORY_OPTIONS = ["VENTURE", "SOBOOJANG", "KOITA", "OTHER"] as const;
type Category = (typeof CATEGORY_OPTIONS)[number];

type Props =
  | {
      mode: "create";
      template?: undefined;
      onClose: () => void;
      onSaved: () => void;
    }
  | {
      mode: "edit";
      template: HwpxTemplateRow;
      onClose: () => void;
      onSaved: () => void;
    };

function validateFieldMap(raw: string): { ok: true; data: unknown } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ok: false, error: "fieldMap은 객체여야 합니다" };
    }
    return { ok: true, data: parsed };
  } catch (err) {
    return {
      ok: false,
      error: `JSON 파싱 실패: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * HWPX template create/edit dialog.
 *
 * In create mode, an HWPX file upload is required. In edit mode, only
 * metadata (name/description/category/fieldMap) can be changed — the file
 * itself is immutable. Admins who need a new file should upload a new
 * template and delete the old one.
 */
export function HwpxTemplateDialog(props: Props) {
  const isCreate = props.mode === "create";
  const initial = isCreate ? null : props.template;

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState<Category>(
    (initial?.category as Category) ?? "OTHER"
  );
  const [fieldMapText, setFieldMapText] = useState(
    initial ? JSON.stringify(initial.fieldMap ?? {}, null, 2) : "{\n  \n}"
  );
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const fieldMapResult = validateFieldMap(fieldMapText);
    if (!fieldMapResult.ok) {
      setError(fieldMapResult.error);
      return;
    }

    if (!name.trim()) {
      setError("이름을 입력하세요");
      return;
    }

    if (isCreate && !file) {
      setError("HWPX 파일을 업로드하세요");
      return;
    }

    setSubmitting(true);
    try {
      if (isCreate) {
        const formData = new FormData();
        formData.append("file", file!);
        formData.append(
          "metadata",
          JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            category,
            fieldMap: fieldMapResult.data,
          })
        );

        const res = await fetch("/api/hwpx/templates", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: { message?: string };
          };
          throw new Error(data.error?.message ?? `HTTP ${res.status}`);
        }
        toast.success("템플릿이 업로드되었습니다");
      } else {
        const res = await fetch(`/api/hwpx/templates/${props.template.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            category,
            fieldMap: fieldMapResult.data,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: { message?: string };
          };
          throw new Error(data.error?.message ?? `HTTP ${res.status}`);
        }
        toast.success("템플릿이 수정되었습니다");
      }
      props.onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(isCreate ? "업로드 실패" : "수정 실패", {
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isCreate ? "HWPX 템플릿 업로드" : "HWPX 템플릿 편집"}
          </DialogTitle>
          <DialogDescription>
            정부 지원사업 양식의 필드 매핑을 JSON으로 관리합니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isCreate ? (
            <div className="space-y-2">
              <Label htmlFor="hwpx-file">HWPX 파일</Label>
              <Input
                id="hwpx-file"
                type="file"
                accept=".hwpx,application/x-hwpx,application/octet-stream"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="hwpx-name">이름</Label>
            <Input
              id="hwpx-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hwpx-desc">설명 (선택)</Label>
            <Input
              id="hwpx-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hwpx-category">카테고리</Label>
            <select
              id="hwpx-category"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hwpx-field-map">필드 매핑 (JSON)</Label>
            <textarea
              id="hwpx-field-map"
              className="flex min-h-[220px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
              value={fieldMapText}
              onChange={(e) => setFieldMapText(e.target.value)}
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              예: <code>{"{ \"company_name\": { \"type\": \"cell\", \"table\": 0, \"row\": 1, \"col\": 2 } }"}</code>
            </p>
          </div>

          {error ? (
            <div className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={props.onClose}
              disabled={submitting}
            >
              취소
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "저장 중..." : isCreate ? "업로드" : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
