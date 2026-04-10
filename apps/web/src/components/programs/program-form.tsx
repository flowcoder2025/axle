"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  cn,
} from "@axle/ui";
import type { ProgramCategory } from "@prisma/client";

export interface ProgramFormData {
  name: string;
  agency: string;
  category: ProgramCategory;
  applicationStart: string;
  applicationEnd: string;
  maxFunding: string;
  region: string;
  announcementUrl: string;
  memo: string;
}

interface ProgramFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Partial<ProgramFormData>;
  programId?: string;
  mode: "create" | "edit";
}

const EMPTY_FORM: ProgramFormData = {
  name: "",
  agency: "",
  category: "GENERAL",
  applicationStart: "",
  applicationEnd: "",
  maxFunding: "",
  region: "",
  announcementUrl: "",
  memo: "",
};

const CATEGORY_OPTIONS: { value: ProgramCategory; label: string }[] = [
  { value: "STARTUP", label: "창업" },
  { value: "VENTURE", label: "벤처" },
  { value: "RND", label: "R&D" },
  { value: "CERTIFICATION", label: "인증" },
  { value: "EXPORT", label: "수출" },
  { value: "SMART_FACTORY", label: "스마트공장" },
  { value: "GENERAL", label: "일반" },
];

const selectCn = cn(
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
  "transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

const textareaCn = cn(
  "flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

export function ProgramForm({
  open,
  onOpenChange,
  initialData,
  programId,
  mode,
}: ProgramFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<ProgramFormData>({
    ...EMPTY_FORM,
    ...initialData,
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof ProgramFormData, string>>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof ProgramFormData, string>> = {};
    if (!form.name.trim()) {
      newErrors.name = "프로그램명은 필수입니다.";
    }
    if (!form.category) {
      newErrors.category = "카테고리는 필수입니다.";
    }
    if (
      form.announcementUrl &&
      !/^https?:\/\/.+/.test(form.announcementUrl)
    ) {
      newErrors.announcementUrl =
        "URL은 http:// 또는 https://로 시작해야 합니다.";
    }
    if (form.maxFunding && isNaN(Number(form.maxFunding))) {
      newErrors.maxFunding = "올바른 금액을 입력하세요.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setServerError(null);

    const payload: Record<string, unknown> = {
      name: form.name,
      category: form.category,
    };
    if (form.agency.trim()) payload.agency = form.agency.trim();
    if (form.region.trim()) payload.region = form.region.trim();
    if (form.announcementUrl.trim())
      payload.announcementUrl = form.announcementUrl.trim();
    if (form.memo.trim()) payload.memo = form.memo.trim();
    if (form.maxFunding) payload.maxFunding = Number(form.maxFunding);
    if (form.applicationStart)
      payload.applicationStart = new Date(form.applicationStart).toISOString();
    if (form.applicationEnd)
      payload.applicationEnd = new Date(form.applicationEnd).toISOString();

    try {
      const url =
        mode === "create" ? "/api/programs" : `/api/programs/${programId}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        setServerError(json?.error?.message ?? "저장 중 오류가 발생했습니다.");
        return;
      }

      onOpenChange(false);
      const savedId: string = json.data?.id ?? programId;
      if (mode === "create") {
        router.push(`/programs/${savedId}`);
      }
      router.refresh();
    } catch {
      setServerError("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "지원사업 추가" : "지원사업 수정"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4 py-4">
            {/* Name and Category */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">
                  프로그램명 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="예: 2024 스타트업 성장 지원사업"
                  disabled={submitting}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="agency">기관</Label>
                <Input
                  id="agency"
                  name="agency"
                  value={form.agency}
                  onChange={handleChange}
                  placeholder="예: 중소벤처기업부"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">
                  카테고리 <span className="text-destructive">*</span>
                </Label>
                <select
                  id="category"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  disabled={submitting}
                  className={selectCn}
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {errors.category && (
                  <p className="text-xs text-destructive">{errors.category}</p>
                )}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="applicationStart">접수 시작일</Label>
                <Input
                  id="applicationStart"
                  name="applicationStart"
                  type="date"
                  value={form.applicationStart}
                  onChange={handleChange}
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="applicationEnd">접수 마감일</Label>
                <Input
                  id="applicationEnd"
                  name="applicationEnd"
                  type="date"
                  value={form.applicationEnd}
                  onChange={handleChange}
                  disabled={submitting}
                />
              </div>
            </div>

            {/* Funding and Region */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maxFunding">최대 지원금 (원)</Label>
                <Input
                  id="maxFunding"
                  name="maxFunding"
                  type="number"
                  min={0}
                  value={form.maxFunding}
                  onChange={handleChange}
                  placeholder="예: 100000000"
                  disabled={submitting}
                />
                {errors.maxFunding && (
                  <p className="text-xs text-destructive">
                    {errors.maxFunding}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="region">지역</Label>
                <Input
                  id="region"
                  name="region"
                  value={form.region}
                  onChange={handleChange}
                  placeholder="예: 전국 / 서울"
                  disabled={submitting}
                />
              </div>
            </div>

            {/* URL */}
            <div className="space-y-2">
              <Label htmlFor="announcementUrl">공고 URL</Label>
              <Input
                id="announcementUrl"
                name="announcementUrl"
                type="url"
                value={form.announcementUrl}
                onChange={handleChange}
                placeholder="https://..."
                disabled={submitting}
              />
              {errors.announcementUrl && (
                <p className="text-xs text-destructive">
                  {errors.announcementUrl}
                </p>
              )}
            </div>

            {/* Memo */}
            <div className="space-y-2">
              <Label htmlFor="memo">메모</Label>
              <textarea
                id="memo"
                name="memo"
                value={form.memo}
                onChange={handleChange}
                rows={3}
                placeholder="지원사업 관련 메모를 입력하세요."
                disabled={submitting}
                className={textareaCn}
              />
            </div>

            {serverError && (
              <p className="text-sm text-destructive">{serverError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              취소
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? "저장 중..."
                : mode === "create"
                ? "지원사업 추가"
                : "변경 저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
