"use client";

import { useState } from "react";
import { ContactList } from "../contacts/contact-list";
import { CertificateList } from "../certificates/certificate-list";
import { ClientProjectList } from "./client-project-list";
import { ClientAchievementList } from "./client-achievement-list";

// ---------------------------------------------------------------------------
// Minimal Client shape passed from server component
// ---------------------------------------------------------------------------
interface ClientSummary {
  id: string;
  name: string;
  businessNumber?: string | null;
  businessStatus?: string | null;
  businessVerifiedAt?: string | null;
  ceoName?: string | null;
  industry?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  memo?: string | null;
  region?: string | null;
  isVenture?: boolean;
  isInnoBiz?: boolean;
  isMainBiz?: boolean;
  isSocial?: boolean;
}

// ---------------------------------------------------------------------------
// Business status badge
// ---------------------------------------------------------------------------
function BusinessStatusBadge({ status }: { status?: string | null }) {
  const resolved = status ?? "미확인";
  const className = (() => {
    switch (resolved) {
      case "정상":
        return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
      case "휴업":
        return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
      case "폐업":
        return "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300";
      default:
        return "border-muted bg-muted/40 text-muted-foreground";
    }
  })();
  return (
    <span
      data-testid="business-status-badge"
      data-status={resolved}
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className,
      ].join(" ")}
    >
      사업자상태: {resolved}
    </span>
  );
}

interface ClientDetailTabsProps {
  clientId: string;
  client: ClientSummary;
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------
const TABS = [
  { id: "info", label: "기본 정보" },
  { id: "contacts", label: "인물" },
  { id: "certificates", label: "인증서" },
  { id: "projects", label: "프로젝트" },
  { id: "achievements", label: "성과" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ClientDetailTabs({ clientId, client }: ClientDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("info");

  return (
    <div className="space-y-4">
      {/* Tab nav */}
      <div className="border-b">
        <nav className="flex gap-0" aria-label="고객사 상세 탭">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
              ].join(" ")}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab panels */}
      <div role="tabpanel">
        {activeTab === "info" && <ClientInfoPanel client={client} />}
        {activeTab === "contacts" && <ContactList clientId={clientId} />}
        {activeTab === "certificates" && (
          <CertificateList clientId={clientId} />
        )}
        {activeTab === "projects" && (
          <ClientProjectList clientId={clientId} />
        )}
        {activeTab === "achievements" && (
          <ClientAchievementList clientId={clientId} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Basic info panel
// ---------------------------------------------------------------------------
function ClientInfoPanel({ client }: { client: ClientSummary }) {
  const rows: Array<{ label: string; value: string | null | undefined }> = [
    { label: "사업자번호", value: client.businessNumber },
    { label: "대표자", value: client.ceoName },
    { label: "업종", value: client.industry },
    { label: "지역", value: client.region },
    { label: "주소", value: client.address },
    { label: "대표 전화", value: client.phone },
    { label: "이메일", value: client.email },
    { label: "웹사이트", value: client.website },
    { label: "메모", value: client.memo },
  ];

  const flags = [
    { label: "벤처기업", active: !!client.isVenture },
    { label: "이노비즈", active: !!client.isInnoBiz },
    { label: "메인비즈", active: !!client.isMainBiz },
    { label: "사회적기업", active: !!client.isSocial },
  ].filter((f) => f.active);

  const verifiedAtLabel = client.businessVerifiedAt
    ? new Date(client.businessVerifiedAt).toLocaleString("ko-KR")
    : null;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <BusinessStatusBadge status={client.businessStatus} />
        {verifiedAtLabel && (
          <span className="text-xs text-muted-foreground">
            최근 확인: {verifiedAtLabel}
          </span>
        )}
      </div>
      <dl className="divide-y rounded-lg border">
        {rows.map(({ label, value }) => (
          <div key={label} className="grid grid-cols-3 gap-4 px-4 py-3">
            <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
            <dd className="col-span-2 text-sm">
              {value ? (
                label === "웹사이트" ? (
                  <a
                    href={value.startsWith("http") ? value : `https://${value}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {value}
                  </a>
                ) : (
                  value
                )
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      {flags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {flags.map((f) => (
            <span
              key={f.label}
              className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium"
            >
              {f.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
