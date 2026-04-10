"use client";

import { useState } from "react";
import { z } from "zod";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
} from "@axle/ui";

// ---------------------------------------------------------------------------
// Schema (mirrors server-side contactCreateSchema)
// ---------------------------------------------------------------------------
const contactFormSchema = z.object({
  name: z.string().min(1, "이름은 필수입니다"),
  position: z.string().optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
  email: z
    .string()
    .optional()
    .refine(
      (v) => !v || v === "" || z.string().email().safeParse(v).success,
      { message: "올바른 이메일 형식이 아닙니다" }
    ),
  isPrimary: z.boolean().optional().default(false),
  isResearcher: z.boolean().optional().default(false),
  researchField: z.string().optional(),
  memo: z.string().optional(),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

// ---------------------------------------------------------------------------
// Contact shape returned from API
// ---------------------------------------------------------------------------
export interface Contact {
  id: string;
  clientId: string;
  name: string;
  position: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
  isResearcher: boolean;
  researchField?: string | null;
  memo?: string | null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface ContactFormProps {
  clientId: string;
  /** When provided, the form is in edit mode */
  contact?: Contact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ContactForm({
  clientId,
  contact,
  open,
  onOpenChange,
  onSuccess,
}: ContactFormProps) {
  const isEdit = !!contact;

  const defaultValues: ContactFormValues = {
    name: contact?.name ?? "",
    position: contact?.position ?? "",
    department: contact?.department ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    isPrimary: contact?.isPrimary ?? false,
    isResearcher: contact?.isResearcher ?? false,
    researchField: contact?.researchField ?? "",
    memo: contact?.memo ?? "",
  };

  const [values, setValues] = useState<ContactFormValues>(defaultValues);
  const [errors, setErrors] = useState<Partial<Record<keyof ContactFormValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Reset when dialog opens/closes or contact changes
  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setValues(defaultValues);
      setErrors({});
      setServerError(null);
    }
    onOpenChange(nextOpen);
  }

  function set<K extends keyof ContactFormValues>(key: K, value: ContactFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    const result = contactFormSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof ContactFormValues, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof ContactFormValues;
        fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const url = isEdit
        ? `/api/clients/${clientId}/contacts/${contact.id}`
        : `/api/clients/${clientId}/contacts`;

      const method = isEdit ? "PATCH" : "POST";

      const payload = {
        ...result.data,
        // Avoid sending empty strings as meaningful values
        position: result.data.position || undefined,
        department: result.data.department || undefined,
        phone: result.data.phone || undefined,
        email: result.data.email || undefined,
        researchField: result.data.researchField || undefined,
        memo: result.data.memo || undefined,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: { message?: string } }).error?.message ?? "저장에 실패했습니다"
        );
      }

      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "저장에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "인물 편집" : "인물 추가"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Name */}
          <div className="space-y-1">
            <Label htmlFor="name">
              이름 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="홍길동"
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Position / Department */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="position">직위</Label>
              <Input
                id="position"
                value={values.position ?? ""}
                onChange={(e) => set("position", e.target.value)}
                placeholder="대표이사"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="department">부서</Label>
              <Input
                id="department"
                value={values.department ?? ""}
                onChange={(e) => set("department", e.target.value)}
                placeholder="연구개발팀"
              />
            </div>
          </div>

          {/* Phone / Email */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="phone">전화</Label>
              <Input
                id="phone"
                type="tel"
                value={values.phone ?? ""}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="010-0000-0000"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                value={values.email ?? ""}
                onChange={(e) => set("email", e.target.value)}
                placeholder="user@example.com"
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 accent-primary"
                checked={values.isPrimary ?? false}
                onChange={(e) => set("isPrimary", e.target.checked)}
              />
              <span className="text-sm font-medium">주 연락처</span>
              <span className="text-xs text-muted-foreground">
                (클라이언트당 1명만 설정 가능)
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 accent-primary"
                checked={values.isResearcher ?? false}
                onChange={(e) => set("isResearcher", e.target.checked)}
              />
              <span className="text-sm font-medium">연구원</span>
            </label>
          </div>

          {/* Research field — only visible when isResearcher */}
          {values.isResearcher && (
            <div className="space-y-1">
              <Label htmlFor="researchField">연구 분야</Label>
              <Input
                id="researchField"
                value={values.researchField ?? ""}
                onChange={(e) => set("researchField", e.target.value)}
                placeholder="인공지능, 바이오 등"
              />
            </div>
          )}

          {/* Memo */}
          <div className="space-y-1">
            <Label htmlFor="memo">메모</Label>
            <textarea
              id="memo"
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={values.memo ?? ""}
              onChange={(e) => set("memo", e.target.value)}
              placeholder="추가 메모"
            />
          </div>

          {serverError && (
            <p className="text-sm text-destructive">{serverError}</p>
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
              {submitting ? "저장 중..." : isEdit ? "수정" : "추가"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
