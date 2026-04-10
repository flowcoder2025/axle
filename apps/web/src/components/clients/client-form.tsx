"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Card, CardContent, CardFooter, CardHeader, CardTitle } from "@axle/ui";

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
  assignedTo: string;
  region: string;
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
  assignedTo: "",
  region: "",
};

const STATUS_OPTIONS: { value: ClientStatus; label: string }[] = [
  { value: "ACTIVE", label: "활성" },
  { value: "INACTIVE", label: "비활성" },
  { value: "PROSPECT", label: "잠재" },
];

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
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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

    const payload: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(form)) {
      payload[key] = value === "" ? undefined : value;
    }
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
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name}</p>
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
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
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
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email}</p>
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
                />
                {errors.website && (
                  <p className="text-xs text-destructive">{errors.website}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>담당 및 메모</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assignedTo">담당자</Label>
              <Input
                id="assignedTo"
                name="assignedTo"
                value={form.assignedTo}
                onChange={handleChange}
                placeholder="담당자 이름"
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
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
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
