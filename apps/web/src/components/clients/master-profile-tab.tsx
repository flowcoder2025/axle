"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, Label, toast } from "@axle/ui";
import { RefreshCw, Save } from "lucide-react";

// ---------------------------------------------------------------------------
// Types (mirrors MasterProfile in apps/web/lib/services/client-profile.ts)
// ---------------------------------------------------------------------------
interface BusinessInfo {
  name: string;
  ceoName: string | null;
  businessNumber: string | null;
  status: string | null;
  industry: string | null;
  region: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  employeeCount: number | null;
  foundedDate: string | null;
}

interface Certifications {
  isVenture: boolean;
  isInnoBiz: boolean;
  isMainBiz: boolean;
  isSocial: boolean;
  ventureValidUntil: string | null;
}

interface MasterProfileShape {
  businessInfo: BusinessInfo;
  certifications: Certifications;
  summary: string;
  // Free-form sections that may be added by future AI regenerations
  [extra: string]: unknown;
}

interface ProfileResponse {
  masterProfile: MasterProfileShape | null;
  profileBlocks: unknown[] | null;
}

interface MasterProfileTabProps {
  clientId: string;
}

const BUSINESS_FIELDS: Array<{ key: keyof BusinessInfo; label: string; type?: "number" }> = [
  { key: "name", label: "기업명" },
  { key: "ceoName", label: "대표자" },
  { key: "businessNumber", label: "사업자번호" },
  { key: "status", label: "사업자 상태" },
  { key: "industry", label: "업종" },
  { key: "region", label: "지역" },
  { key: "address", label: "주소" },
  { key: "phone", label: "대표 전화" },
  { key: "email", label: "이메일" },
  { key: "website", label: "웹사이트" },
  { key: "employeeCount", label: "직원 수", type: "number" },
  { key: "foundedDate", label: "설립일" },
];

const CERT_FIELDS: Array<{ key: keyof Certifications; label: string }> = [
  { key: "isVenture", label: "벤처기업" },
  { key: "isInnoBiz", label: "이노비즈" },
  { key: "isMainBiz", label: "메인비즈" },
  { key: "isSocial", label: "사회적기업" },
];

function emptyProfile(): MasterProfileShape {
  return {
    businessInfo: {
      name: "",
      ceoName: null,
      businessNumber: null,
      status: null,
      industry: null,
      region: null,
      address: null,
      phone: null,
      email: null,
      website: null,
      employeeCount: null,
      foundedDate: null,
    },
    certifications: {
      isVenture: false,
      isInnoBiz: false,
      isMainBiz: false,
      isSocial: false,
      ventureValidUntil: null,
    },
    summary: "",
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function MasterProfileTab({ clientId }: MasterProfileTabProps) {
  const [profile, setProfile] = useState<MasterProfileShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/profile`);
      if (!res.ok) throw new Error("프로필을 불러오지 못했습니다");
      const json = (await res.json()) as { data: ProfileResponse };
      setProfile(json.data.masterProfile ?? emptyProfile());
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const updateBusiness = useCallback(
    <K extends keyof BusinessInfo>(key: K, value: BusinessInfo[K]) => {
      setProfile((prev) => {
        const base = prev ?? emptyProfile();
        return {
          ...base,
          businessInfo: { ...base.businessInfo, [key]: value },
        };
      });
      setDirty(true);
    },
    [],
  );

  const updateCert = useCallback(
    <K extends keyof Certifications>(key: K, value: Certifications[K]) => {
      setProfile((prev) => {
        const base = prev ?? emptyProfile();
        return {
          ...base,
          certifications: { ...base.certifications, [key]: value },
        };
      });
      setDirty(true);
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/profile`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ masterProfile: profile }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.error?.message ?? "저장에 실패했습니다");
      }
      toast.success("마스터 프로필이 저장되었습니다");
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setSaving(false);
    }
  }, [clientId, profile]);

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/profile`, {
        method: "POST",
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.error?.message ?? "재생성에 실패했습니다");
      }
      const json = (await res.json()) as { data: ProfileResponse };
      setProfile(json.data.masterProfile ?? emptyProfile());
      setDirty(false);
      toast.success("마스터 프로필을 재생성했습니다");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setRegenerating(false);
    }
  }, [clientId]);

  const businessInfo = useMemo(
    () => profile?.businessInfo ?? emptyProfile().businessInfo,
    [profile],
  );
  const certifications = useMemo(
    () => profile?.certifications ?? emptyProfile().certifications,
    [profile],
  );

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        불러오는 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
        <button
          type="button"
          onClick={fetchProfile}
          className="text-sm text-primary hover:underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">마스터 프로필</h3>
          <p className="text-xs text-muted-foreground">
            AI가 추정한 기업 스냅샷입니다. 필요한 경우 수동으로 편집하거나 AI로 다시 생성할 수 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleRegenerate}
            disabled={regenerating}
            data-testid="profile-regenerate"
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`}
            />
            {regenerating ? "생성 중..." : "AI 재생성"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!dirty || saving}
            data-testid="profile-save"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {saving ? "저장 중..." : "저장"}
          </Button>
        </div>
      </div>

      {/* Business info */}
      <section className="space-y-3 rounded-lg border p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          기업 개요
        </h4>
        <div className="grid gap-3 sm:grid-cols-2">
          {BUSINESS_FIELDS.map((field) => {
            const raw = businessInfo[field.key];
            const value =
              raw == null ? "" : typeof raw === "number" ? String(raw) : raw;
            return (
              <div key={String(field.key)} className="space-y-1">
                <Label htmlFor={`mp-${String(field.key)}`} className="text-xs">
                  {field.label}
                </Label>
                <Input
                  id={`mp-${String(field.key)}`}
                  type={field.type ?? "text"}
                  value={value}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (field.type === "number") {
                      updateBusiness(field.key, v === "" ? null : (Number(v) as never));
                    } else {
                      updateBusiness(field.key, v === "" ? null : (v as never));
                    }
                  }}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* Certifications */}
      <section className="space-y-3 rounded-lg border p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          인증 현황
        </h4>
        <div className="flex flex-wrap gap-3">
          {CERT_FIELDS.map((field) => (
            <label
              key={field.key}
              className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
            >
              <input
                type="checkbox"
                checked={!!certifications[field.key]}
                onChange={(e) => updateCert(field.key, e.target.checked)}
              />
              {field.label}
            </label>
          ))}
        </div>
        <div className="space-y-1">
          <Label htmlFor="mp-ventureValidUntil" className="text-xs">
            벤처 유효기간
          </Label>
          <Input
            id="mp-ventureValidUntil"
            type="date"
            value={certifications.ventureValidUntil ?? ""}
            onChange={(e) =>
              updateCert(
                "ventureValidUntil",
                e.target.value === "" ? null : e.target.value,
              )
            }
          />
        </div>
      </section>

      {/* Summary */}
      <section className="space-y-2 rounded-lg border p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          요약
        </h4>
        <textarea
          className="flex min-h-[120px] w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={profile?.summary ?? ""}
          onChange={(e) => {
            setProfile((prev) => ({
              ...(prev ?? emptyProfile()),
              summary: e.target.value,
            }));
            setDirty(true);
          }}
        />
      </section>
    </div>
  );
}
