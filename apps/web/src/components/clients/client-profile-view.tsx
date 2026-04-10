"use client";

import type { ProfileBlock, ProfileBlockField } from "@/lib/services/client-profile";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ClientProfileViewProps {
  profileBlocks: ProfileBlock[] | null | undefined;
  summary?: string | null;
}

// ---------------------------------------------------------------------------
// Block renderers
// ---------------------------------------------------------------------------

function InfoBlock({ block }: { block: ProfileBlock }) {
  const nonEmptyFields = block.fields.filter((f) => f.value != null);

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="px-5 py-4 border-b">
        <h3 className="text-sm font-semibold">{block.title}</h3>
      </div>
      <dl className="divide-y">
        {nonEmptyFields.length === 0 ? (
          <div className="px-5 py-4 text-sm text-muted-foreground">정보 없음</div>
        ) : (
          nonEmptyFields.map((field) => (
            <FieldRow key={field.label} field={field} />
          ))
        )}
      </dl>
    </div>
  );
}

function CertBlock({ block }: { block: ProfileBlock }) {
  const active = block.fields.filter((f) => f.value === "인증");
  const inactive = block.fields.filter(
    (f) => f.value !== "인증" && f.label !== "벤처 유효기간"
  );
  const ventureUntil = block.fields.find((f) => f.label === "벤처 유효기간");

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="px-5 py-4 border-b">
        <h3 className="text-sm font-semibold">{block.title}</h3>
      </div>
      <div className="px-5 py-4 space-y-3">
        {active.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              보유 인증
            </p>
            <div className="flex flex-wrap gap-2">
              {active.map((f) => (
                <CertBadge key={f.label} label={f.label} active />
              ))}
            </div>
          </div>
        )}

        {inactive.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              미보유
            </p>
            <div className="flex flex-wrap gap-2">
              {inactive.map((f) => (
                <CertBadge key={f.label} label={f.label} active={false} />
              ))}
            </div>
          </div>
        )}

        {ventureUntil?.value && (
          <p className="text-xs text-muted-foreground">
            벤처 유효기간: {ventureUntil.value}
          </p>
        )}

        {active.length === 0 && inactive.length === 0 && (
          <p className="text-sm text-muted-foreground">인증 정보 없음</p>
        )}
      </div>
    </div>
  );
}

function FinancialBlock({ block }: { block: ProfileBlock }) {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="px-5 py-4 border-b">
        <h3 className="text-sm font-semibold">{block.title}</h3>
      </div>
      <div className="px-5 py-4 space-y-3">
        {/* Placeholder for future chart/table */}
        <div className="rounded-md bg-muted/50 h-28 flex items-center justify-center">
          <span className="text-xs text-muted-foreground">재무 차트 (준비 중)</span>
        </div>
        <dl className="divide-y">
          {block.fields.map((field) => (
            <FieldRow key={field.label} field={field} />
          ))}
        </dl>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function FieldRow({ field }: { field: ProfileBlockField }) {
  return (
    <div className="grid grid-cols-3 gap-4 px-5 py-2.5">
      <dt className="text-sm font-medium text-muted-foreground">{field.label}</dt>
      <dd className="col-span-2 text-sm">
        {field.value ?? <span className="text-muted-foreground">-</span>}
      </dd>
    </div>
  );
}

function CertBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border",
        active
          ? "bg-primary/10 text-primary border-primary/30"
          : "text-muted-foreground border-border bg-muted/30",
      ].join(" ")}
    >
      {active && (
        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-primary inline-block" />
      )}
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ClientProfileView({ profileBlocks, summary }: ClientProfileViewProps) {
  if (!profileBlocks || profileBlocks.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        AI 프로필이 아직 생성되지 않았습니다. 잠시 후 다시 확인해 주세요.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {summary && (
        <div className="rounded-lg border bg-muted/30 px-5 py-4">
          <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {profileBlocks.map((block, index) => {
          const key = `${block.type}-${index}`;
          if (block.type === "info") return <InfoBlock key={key} block={block} />;
          if (block.type === "cert") return <CertBlock key={key} block={block} />;
          if (block.type === "financial") return <FinancialBlock key={key} block={block} />;
          return null;
        })}
      </div>
    </div>
  );
}
