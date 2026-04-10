"use client";

import { useState } from "react";
import { ContactList } from "../contacts/contact-list";
import { CertificateList } from "../certificates/certificate-list";

// ---------------------------------------------------------------------------
// Minimal Client shape passed from server component
// ---------------------------------------------------------------------------
interface ClientSummary {
  id: string;
  name: string;
  businessNumber?: string | null;
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
] as const;

type TabId = (typeof TABS)[number]["id"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ClientDetailTabs({ clientId, client }: ClientDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("contacts");

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
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            프로젝트 탭은 추후 구현 예정입니다.
          </div>
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

  return (
    <div className="max-w-2xl space-y-4">
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
