"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Card, CardContent, CardFooter, CardHeader, CardTitle, cn } from "@axle/ui";
import { PROJECT_TYPE_LABELS } from "./project-type-badge";
import type { ProjectType } from "@prisma/client";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type FeeType = "FIXED" | "SUCCESS_RATE" | "MONTHLY";

interface ClientOption {
  id: string;
  name: string;
}

export interface ProjectFormData {
  clientId: string;
  title: string;
  type: ProjectType;
  priority: Priority;
  assignedToId: string;
  dueDate: string;
  memo: string;
  feeType: FeeType | "";
  feeAmount: string;
  successRate: string;
  isPaid: boolean;
  childTypes: ProjectType[];
}

interface ProjectFormProps {
  clients: ClientOption[];
  initialClientId?: string;
}

const EMPTY_FORM: ProjectFormData = {
  clientId: "",
  title: "",
  type: "BUSINESS_PLAN",
  priority: "MEDIUM",
  assignedToId: "",
  dueDate: "",
  memo: "",
  feeType: "",
  feeAmount: "",
  successRate: "",
  isPaid: false,
  childTypes: [],
};

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "LOW", label: "낮음" },
  { value: "MEDIUM", label: "보통" },
  { value: "HIGH", label: "높음" },
  { value: "URGENT", label: "긴급" },
];

const FEE_TYPE_OPTIONS: { value: FeeType; label: string }[] = [
  { value: "FIXED", label: "고정 수수료" },
  { value: "SUCCESS_RATE", label: "성공 보수" },
  { value: "MONTHLY", label: "월정액" },
];

const BUNDLE_CHILD_TYPES: ProjectType[] = [
  "BUSINESS_PLAN",
  "VENTURE_CERT",
  "SOBOOJANG_CERT",
  "RESEARCH_INSTITUTE",
  "PATENT",
  "FINANCIAL_ANALYSIS",
  "RESEARCH_TASK",
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

export function ProjectForm({ clients, initialClientId }: ProjectFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<ProjectFormData>({
    ...EMPTY_FORM,
    clientId: initialClientId ?? "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectFormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  function handleChildTypeToggle(childType: ProjectType) {
    setForm((prev) => {
      const has = prev.childTypes.includes(childType);
      return {
        ...prev,
        childTypes: has
          ? prev.childTypes.filter((t) => t !== childType)
          : [...prev.childTypes, childType],
      };
    });
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof ProjectFormData, string>> = {};
    if (!form.clientId) newErrors.clientId = "고객사를 선택하세요.";
    if (!form.title.trim()) newErrors.title = "프로젝트명은 필수입니다.";
    if (form.feeType === "SUCCESS_RATE" && !form.successRate)
      newErrors.successRate = "성공 보수율을 입력하세요.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setServerError(null);

    const payload: Record<string, unknown> = {
      clientId: form.clientId,
      title: form.title,
      type: form.type,
      priority: form.priority,
      isPaid: form.isPaid,
    };

    if (form.assignedToId.trim()) payload.assignedToId = form.assignedToId.trim();
    if (form.dueDate) payload.dueDate = new Date(form.dueDate).toISOString();
    if (form.memo.trim()) payload.memo = form.memo.trim();
    if (form.feeType) payload.feeType = form.feeType;
    if (form.feeAmount) payload.feeAmount = Number(form.feeAmount);
    if (form.successRate) payload.successRate = Number(form.successRate);
    if (form.type === "BUNDLE" && form.childTypes.length > 0) {
      payload.childTypes = form.childTypes;
    }

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        setServerError(json?.error?.message ?? "저장 중 오류가 발생했습니다.");
        return;
      }

      const savedId: string = json.data?.id;
      router.push(`/projects/${savedId}`);
      router.refresh();
    } catch {
      setServerError("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  const isBundle = form.type === "BUNDLE";
  const showFeeAmount = form.feeType === "FIXED" || form.feeType === "MONTHLY";
  const showSuccessRate = form.feeType === "SUCCESS_RATE";

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="clientId">
                  고객사 <span className="text-destructive">*</span>
                </Label>
                <select
                  id="clientId"
                  name="clientId"
                  value={form.clientId}
                  onChange={handleChange}
                  disabled={submitting}
                  className={selectCn}
                >
                  <option value="">고객사를 선택하세요</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {errors.clientId && (
                  <p className="text-xs text-destructive">{errors.clientId}</p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="title">
                  프로젝트명 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="예: 2024년 벤처기업 인증 지원"
                  disabled={submitting}
                />
                {errors.title && (
                  <p className="text-xs text-destructive">{errors.title}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">프로젝트 유형</Label>
                <select
                  id="type"
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  disabled={submitting}
                  className={selectCn}
                >
                  {(Object.keys(PROJECT_TYPE_LABELS) as ProjectType[]).map((t) => (
                    <option key={t} value={t}>
                      {PROJECT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">우선순위</Label>
                <select
                  id="priority"
                  name="priority"
                  value={form.priority}
                  onChange={handleChange}
                  disabled={submitting}
                  className={selectCn}
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignedToId">담당자 ID</Label>
                <Input
                  id="assignedToId"
                  name="assignedToId"
                  value={form.assignedToId}
                  onChange={handleChange}
                  placeholder="담당자 ID"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">마감일</Label>
                <Input
                  id="dueDate"
                  name="dueDate"
                  type="date"
                  value={form.dueDate}
                  onChange={handleChange}
                  disabled={submitting}
                />
              </div>
            </div>

            {/* BUNDLE child type selector */}
            {isBundle && (
              <div className="space-y-2 rounded-md border p-4 bg-muted/30">
                <Label>묶음 하위 유형 (선택사항)</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  선택하지 않으면 기본 하위 유형 전체가 생성됩니다.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {BUNDLE_CHILD_TYPES.map((ct) => (
                    <label key={ct} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.childTypes.includes(ct)}
                        onChange={() => handleChildTypeToggle(ct)}
                        disabled={submitting}
                        className="h-4 w-4 rounded border-gray-300 accent-primary"
                      />
                      <span className="text-sm">{PROJECT_TYPE_LABELS[ct]}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="memo">메모</Label>
              <textarea
                id="memo"
                name="memo"
                value={form.memo}
                onChange={handleChange}
                rows={3}
                placeholder="프로젝트 관련 메모를 입력하세요."
                disabled={submitting}
                className={textareaCn}
              />
            </div>
          </CardContent>
        </Card>

        {/* Fee Info */}
        <Card>
          <CardHeader>
            <CardTitle>수수료 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="feeType">수수료 유형</Label>
                <select
                  id="feeType"
                  name="feeType"
                  value={form.feeType}
                  onChange={handleChange}
                  disabled={submitting}
                  className={selectCn}
                >
                  <option value="">없음</option>
                  {FEE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {showFeeAmount && (
                <div className="space-y-2">
                  <Label htmlFor="feeAmount">수수료 금액 (원)</Label>
                  <Input
                    id="feeAmount"
                    name="feeAmount"
                    type="number"
                    min={0}
                    value={form.feeAmount}
                    onChange={handleChange}
                    placeholder="예: 3000000"
                    disabled={submitting}
                  />
                </div>
              )}

              {showSuccessRate && (
                <div className="space-y-2">
                  <Label htmlFor="successRate">성공 보수율 (%)</Label>
                  <Input
                    id="successRate"
                    name="successRate"
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={form.successRate}
                    onChange={handleChange}
                    placeholder="예: 10"
                    disabled={submitting}
                  />
                  {errors.successRate && (
                    <p className="text-xs text-destructive">{errors.successRate}</p>
                  )}
                </div>
              )}
            </div>

            {form.feeType && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="isPaid"
                  checked={form.isPaid}
                  onChange={handleChange}
                  disabled={submitting}
                  className="h-4 w-4 rounded border-gray-300 accent-primary"
                />
                <span className="text-sm font-medium">수수료 납부 완료</span>
              </label>
            )}
          </CardContent>
          <CardFooter className="flex items-center gap-3">
            {serverError && (
              <p className="flex-1 text-sm text-destructive">{serverError}</p>
            )}
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={submitting}
              >
                취소
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "저장 중..." : "프로젝트 추가"}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </form>
  );
}
