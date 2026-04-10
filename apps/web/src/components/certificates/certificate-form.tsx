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
// Schema (mirrors server-side certificateCreateSchema)
// ---------------------------------------------------------------------------
const certificateFormSchema = z.object({
  type: z.string().min(1, "유형은 필수입니다"),
  subjectName: z.string().min(1, "주체명은 필수입니다"),
  serialNumber: z.string().optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
});

type CertificateFormValues = z.infer<typeof certificateFormSchema>;

// ---------------------------------------------------------------------------
// Certificate shape returned from API
// ---------------------------------------------------------------------------
export interface Certificate {
  id: string;
  clientId: string;
  type: string;
  subjectName: string;
  serialNumber: string | null;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
  storagePath: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface CertificateFormProps {
  clientId: string;
  /** When provided, the form is in edit mode */
  certificate?: Certificate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert ISO datetime string to "yyyy-MM-dd" for date input */
function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

/** Convert "yyyy-MM-dd" date input to ISO datetime string (midnight UTC) */
function dateInputToIso(date: string): string | undefined {
  if (!date) return undefined;
  return new Date(date).toISOString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function CertificateForm({
  clientId,
  certificate,
  open,
  onOpenChange,
  onSuccess,
}: CertificateFormProps) {
  const isEdit = !!certificate;

  const defaultValues: CertificateFormValues = {
    type: certificate?.type ?? "",
    subjectName: certificate?.subjectName ?? "",
    serialNumber: certificate?.serialNumber ?? "",
    validFrom: isoToDateInput(certificate?.validFrom),
    validTo: isoToDateInput(certificate?.validTo),
  };

  const [values, setValues] = useState<CertificateFormValues>(defaultValues);
  const [errors, setErrors] = useState<
    Partial<Record<keyof CertificateFormValues, string>>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setValues(defaultValues);
      setErrors({});
      setServerError(null);
    }
    onOpenChange(nextOpen);
  }

  function set<K extends keyof CertificateFormValues>(
    key: K,
    value: CertificateFormValues[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    const result = certificateFormSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof CertificateFormValues, string>> =
        {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof CertificateFormValues;
        fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const url = isEdit
        ? `/api/clients/${clientId}/certificates/${certificate.id}`
        : `/api/clients/${clientId}/certificates`;

      const method = isEdit ? "PATCH" : "POST";

      const payload = {
        type: result.data.type,
        subjectName: result.data.subjectName,
        serialNumber: result.data.serialNumber || undefined,
        validFrom: dateInputToIso(result.data.validFrom ?? ""),
        validTo: dateInputToIso(result.data.validTo ?? ""),
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: { message?: string } }).error?.message ??
            "저장에 실패했습니다"
        );
      }

      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "저장에 실패했습니다"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "인증서 편집" : "인증서 등록"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Type */}
          <div className="space-y-1">
            <Label htmlFor="cert-type">
              유형 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cert-type"
              value={values.type}
              onChange={(e) => set("type", e.target.value)}
              placeholder="공인인증서, SSL, 코드사이닝 등"
            />
            {errors.type && (
              <p className="text-xs text-destructive">{errors.type}</p>
            )}
          </div>

          {/* Subject Name */}
          <div className="space-y-1">
            <Label htmlFor="cert-subjectName">
              주체 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cert-subjectName"
              value={values.subjectName}
              onChange={(e) => set("subjectName", e.target.value)}
              placeholder="CN=example.com, O=회사명"
            />
            {errors.subjectName && (
              <p className="text-xs text-destructive">{errors.subjectName}</p>
            )}
          </div>

          {/* Serial Number */}
          <div className="space-y-1">
            <Label htmlFor="cert-serialNumber">일련번호</Label>
            <Input
              id="cert-serialNumber"
              value={values.serialNumber ?? ""}
              onChange={(e) => set("serialNumber", e.target.value)}
              placeholder="AB:CD:EF:01:23:45"
            />
          </div>

          {/* Valid From / Valid To */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="cert-validFrom">유효 시작일</Label>
              <Input
                id="cert-validFrom"
                type="date"
                value={values.validFrom ?? ""}
                onChange={(e) => set("validFrom", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cert-validTo">유효 만료일</Label>
              <Input
                id="cert-validTo"
                type="date"
                value={values.validTo ?? ""}
                onChange={(e) => set("validTo", e.target.value)}
              />
            </div>
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
              {submitting ? "저장 중..." : isEdit ? "수정" : "등록"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
