"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Card, CardContent, CardFooter, CardHeader, CardTitle, cn } from "@axle/ui";

type ClientStatus = "ACTIVE" | "INACTIVE" | "PROSPECT";

export interface ClientFormData {
  name: string;
  businessNumber: string;
  ceoName: string;
  industry: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  memo: string;
  status: ClientStatus;
  assignedToId: string;
  region: string;
  employeeCount?: number;
  capitalAmount?: number;
  foundedDate: string;
  isVenture: boolean;
  isInnoBiz: boolean;
  isMainBiz: boolean;
  isSocial: boolean;
  ventureValidUntil: string;
}

interface ClientFormProps {
  initialData?: Partial<ClientFormData>;
  clientId?: string;
  mode: "create" | "edit";
}

const EMPTY_FORM: ClientFormData = {
  name: "",
  businessNumber: "",
  ceoName: "",
  industry: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  memo: "",
  status: "ACTIVE",
  assignedToId: "",
  region: "",
  employeeCount: undefined,
  capitalAmount: undefined,
  foundedDate: "",
  isVenture: false,
  isInnoBiz: false,
  isMainBiz: false,
  isSocial: false,
  ventureValidUntil: "",
};

const STATUS_OPTIONS: { value: ClientStatus; label: string }[] = [
  { value: "ACTIVE", label: "활성" },
  { value: "INACTIVE", label: "비활성" },
  { value: "PROSPECT", label: "잠재" },
];

// Shared className for native form controls styled to match @axle/ui Input
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

const checkboxLabelCn = "flex items-center gap-2 cursor-pointer select-none";
const checkboxCn = "h-4 w-4 rounded border-gray-300 accent-primary cursor-pointer";

export function ClientForm({ initialData, clientId, mode }: ClientFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<ClientFormData>({
    ...EMPTY_FORM,
    ...initialData,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ClientFormData, string>>>({});
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

  function handleNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value === "" ? undefined : Number(value),
    }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof ClientFormData, string>> = {};
    if (!form.name.trim()) {
      newErrors.name = "고객사명은 필수입니다.";
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "올바른 이메일 형식이 아닙니다.";
    }
    if (form.website && !/^https?:\/\/.+/.test(form.website)) {
      newErrors.website = "URL은 http:// 또는 https://로 시작해야 합니다.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setServerError(null);

    // Build payload, stripping empty strings to undefined
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(form)) {
      if (typeof value === "boolean") {
        payload[key] = value;
      } else if (typeof value === "number") {
        payload[key] = value;
      } else if (value === "" || value === undefined) {
        payload[key] = undefined;
      } else {
        payload[key] = value;
      }
    }
    // Always include required fields
    payload.name = form.name;
    payload.status = form.status;

    try {
      const url =
        mode === "create" ? "/api/clients" : `/api/clients/${clientId}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        setServerError(
          json?.error?.message ?? "저장 중 오류가 발생했습니다."
        );
        return;
      }

      const savedId: string = json.data?.id ?? clientId;
      router.push(`/clients/${savedId}`);
      router.refresh();
    } catch {
      setServerError("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

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
              <div className="space-y-2">
                <Label htmlFor="name">
                  고객사명 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="예: (주)테크스타트"
                  disabled={submitting}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "name-error" : undefined}
                />
                {errors.name && (
                  <p id="name-error" role="alert" className="text-xs text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessNumber">사업자등록번호</Label>
                <Input
                  id="businessNumber"
                  name="businessNumber"
                  value={form.businessNumber}
                  onChange={handleChange}
                  placeholder="예: 123-45-67890"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ceoName">대표자명</Label>
                <Input
                  id="ceoName"
                  name="ceoName"
                  value={form.ceoName}
                  onChange={handleChange}
                  placeholder="예: 홍길동"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">업종</Label>
                <Input
                  id="industry"
                  name="industry"
                  value={form.industry}
                  onChange={handleChange}
                  placeholder="예: 소프트웨어 개발"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="region">지역</Label>
                <Input
                  id="region"
                  name="region"
                  value={form.region}
                  onChange={handleChange}
                  placeholder="예: 서울특별시"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">상태</Label>
                <select
                  id="status"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  disabled={submitting}
                  className={selectCn}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="foundedDate">설립일</Label>
                <Input
                  id="foundedDate"
                  name="foundedDate"
                  type="date"
                  value={form.foundedDate}
                  onChange={handleChange}
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employeeCount">직원 수</Label>
                <Input
                  id="employeeCount"
                  name="employeeCount"
                  type="number"
                  min={0}
                  value={form.employeeCount ?? ""}
                  onChange={handleNumberChange}
                  placeholder="예: 50"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="capitalAmount">자본금 (원)</Label>
                <Input
                  id="capitalAmount"
                  name="capitalAmount"
                  type="number"
                  min={0}
                  value={form.capitalAmount ?? ""}
                  onChange={handleNumberChange}
                  placeholder="예: 100000000"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">주소</Label>
              <Input
                id="address"
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="예: 서울특별시 강남구 테헤란로 123"
                disabled={submitting}
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle>연락처 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">전화번호</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="예: 02-1234-5678"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="예: contact@company.com"
                  disabled={submitting}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                />
                {errors.email && (
                  <p id="email-error" role="alert" className="text-xs text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="website">웹사이트</Label>
                <Input
                  id="website"
                  name="website"
                  type="url"
                  value={form.website}
                  onChange={handleChange}
                  placeholder="예: https://www.company.com"
                  disabled={submitting}
                  aria-invalid={!!errors.website}
                  aria-describedby={errors.website ? "website-error" : undefined}
                />
                {errors.website && (
                  <p id="website-error" role="alert" className="text-xs text-destructive">{errors.website}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Certification Status */}
        <Card>
          <CardHeader>
            <CardTitle>인증 현황</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className={checkboxLabelCn}>
                <input
                  type="checkbox"
                  name="isVenture"
                  className={checkboxCn}
                  checked={form.isVenture}
                  onChange={handleChange}
                  disabled={submitting}
                />
                <span className="text-sm font-medium">벤처기업</span>
              </label>

              <label className={checkboxLabelCn}>
                <input
                  type="checkbox"
                  name="isInnoBiz"
                  className={checkboxCn}
                  checked={form.isInnoBiz}
                  onChange={handleChange}
                  disabled={submitting}
                />
                <span className="text-sm font-medium">이노비즈</span>
              </label>

              <label className={checkboxLabelCn}>
                <input
                  type="checkbox"
                  name="isMainBiz"
                  className={checkboxCn}
                  checked={form.isMainBiz}
                  onChange={handleChange}
                  disabled={submitting}
                />
                <span className="text-sm font-medium">메인비즈</span>
              </label>

              <label className={checkboxLabelCn}>
                <input
                  type="checkbox"
                  name="isSocial"
                  className={checkboxCn}
                  checked={form.isSocial}
                  onChange={handleChange}
                  disabled={submitting}
                />
                <span className="text-sm font-medium">사회적기업</span>
              </label>
            </div>

            {form.isVenture && (
              <div className="space-y-2">
                <Label htmlFor="ventureValidUntil">벤처 유효기간</Label>
                <Input
                  id="ventureValidUntil"
                  name="ventureValidUntil"
                  type="date"
                  value={form.ventureValidUntil}
                  onChange={handleChange}
                  disabled={submitting}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assignment & Memo */}
        <Card>
          <CardHeader>
            <CardTitle>담당 및 메모</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Label htmlFor="memo">메모</Label>
              <textarea
                id="memo"
                name="memo"
                value={form.memo}
                onChange={handleChange}
                rows={4}
                placeholder="고객사 관련 메모를 입력하세요."
                disabled={submitting}
                className={textareaCn}
              />
            </div>
          </CardContent>
          <CardFooter className="flex items-center gap-3">
            {serverError && (
              <p role="alert" className="flex-1 text-sm text-destructive">{serverError}</p>
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
                {submitting
                  ? "저장 중..."
                  : mode === "create"
                  ? "고객사 추가"
                  : "변경 저장"}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </form>
  );
}
