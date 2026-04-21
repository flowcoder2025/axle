"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  toast,
} from "@axle/ui";
import { Check, Copy, Link as LinkIcon } from "lucide-react";

export type PortalTokenScope = "FULL" | "UPLOAD" | "JOURNAL";

const SCOPE_OPTIONS: Array<{ value: PortalTokenScope; label: string; description: string }> = [
  { value: "UPLOAD", label: "파일 업로드", description: "서류 업로드만 허용" },
  { value: "JOURNAL", label: "연구 일지", description: "연구일지 작성·제출만 허용" },
  { value: "FULL", label: "전체 접근", description: "업로드 + 일지 + 체크리스트" },
];

const EXPIRY_PRESETS = [
  { label: "7일", days: 7 },
  { label: "14일", days: 14 },
  { label: "30일", days: 30 },
  { label: "만료일 없음", days: null },
] as const;

export interface PortalTokenCreated {
  id: string;
  token: string;
  scope: PortalTokenScope;
  expiresAt: string | null;
  projectId: string | null;
  createdAt: string;
}

interface PortalTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Either a clientId (for client-level tokens) or a projectId (for project-level).
   * Exactly one must be set.
   */
  target: { clientId: string } | { projectId: string };
  onCreated?: (token: PortalTokenCreated) => void;
}

/**
 * Shared portal-token creation dialog.
 *
 * Used on both the client detail page (서류 요청 탭) and the project detail
 * page so the portal link UX is consistent regardless of where the token is
 * scoped. The underlying PortalToken model already carries both ids —
 * project-level tokens additionally set projectId.
 */
export function PortalTokenDialog({
  open,
  onOpenChange,
  target,
  onCreated,
}: PortalTokenDialogProps) {
  const [scope, setScope] = useState<PortalTokenScope>("UPLOAD");
  const [expiryDays, setExpiryDays] = useState<number | null>(14);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<PortalTokenCreated | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset state whenever dialog opens fresh
  useEffect(() => {
    if (open) {
      setCreated(null);
      setCopied(false);
      setScope("UPLOAD");
      setExpiryDays(14);
    }
  }, [open]);

  const portalUrl = created
    ? `${typeof window === "undefined" ? "" : window.location.origin}/portal/${created.token}`
    : "";

  const handleCreate = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint =
        "clientId" in target
          ? `/api/clients/${target.clientId}/portal-tokens`
          : `/api/projects/${target.projectId}/portal-tokens`;

      const expiresAt = expiryDays
        ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope, expiresAt }),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(
          detail?.error?.message ?? "포털 토큰 생성에 실패했습니다",
        );
      }

      const json = await res.json();
      setCreated(json.data as PortalTokenCreated);
      onCreated?.(json.data as PortalTokenCreated);
      toast.success("포털 링크가 생성되었습니다");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }, [target, scope, expiryDays, onCreated]);

  const handleCopy = useCallback(async () => {
    if (!portalUrl) return;
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      toast.success("링크가 복사되었습니다");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("클립보드 복사에 실패했습니다");
    }
  }, [portalUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>포털 링크 생성</DialogTitle>
          <DialogDescription>
            고객사에 공유할 포털 접근 링크를 생성합니다. 링크만 있으면 로그인 없이
            설정한 범위의 작업을 수행할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="portal-url">생성된 포털 링크</Label>
              <div className="flex gap-2">
                <Input
                  id="portal-url"
                  readOnly
                  value={portalUrl}
                  data-testid="portal-token-url"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  aria-label="링크 복사"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-2 rounded-md border bg-muted/30 p-3 text-xs">
              <dt className="text-muted-foreground">범위</dt>
              <dd>{SCOPE_OPTIONS.find((o) => o.value === created.scope)?.label ?? created.scope}</dd>
              <dt className="text-muted-foreground">만료일</dt>
              <dd>
                {created.expiresAt
                  ? new Date(created.expiresAt).toLocaleString("ko-KR")
                  : "만료일 없음"}
              </dd>
            </dl>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>접근 범위</Label>
              <div className="grid gap-2">
                {SCOPE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={[
                      "flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm",
                      scope === opt.value
                        ? "border-primary bg-primary/5"
                        : "hover:border-border",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="portal-scope"
                      value={opt.value}
                      checked={scope === opt.value}
                      onChange={() => setScope(opt.value)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {opt.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>유효 기간</Label>
              <div className="flex flex-wrap gap-2">
                {EXPIRY_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setExpiryDays(preset.days)}
                    className={[
                      "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                      expiryDays === preset.days
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:border-border",
                    ].join(" ")}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {created ? (
            <Button type="button" onClick={() => onOpenChange(false)}>
              닫기
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                취소
              </Button>
              <Button
                type="button"
                onClick={handleCreate}
                disabled={loading}
                data-testid="portal-token-create"
              >
                <LinkIcon className="mr-1.5 h-3.5 w-3.5" />
                {loading ? "생성 중..." : "링크 생성"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
