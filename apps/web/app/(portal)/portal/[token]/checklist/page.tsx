import { notFound } from "next/navigation";

interface ChecklistItem {
  id: string;
  name: string;
  description: string | null;
  isRequired: boolean;
  status: string;
  requestedAt: string | null;
  uploadedAt: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: string }> = {
  PENDING: {
    label: "대기",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    icon: "⏳",
  },
  REQUESTED: {
    label: "요청됨",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    icon: "📨",
  },
  UPLOADED: {
    label: "업로드 완료",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    icon: "✅",
  },
  APPROVED: {
    label: "승인",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    icon: "✔️",
  },
  REJECTED: {
    label: "반려",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    icon: "❌",
  },
};

async function getChecklist(token: string): Promise<ChecklistItem[] | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/portal/${token}/checklist`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = await res.json() as { data: ChecklistItem[] };
  return json.data;
}

type Props = { params: Promise<{ token: string }> };

export default async function PortalChecklistPage({ params }: Props) {
  const { token } = await params;
  const items = await getChecklist(token);

  if (items === null) {
    notFound();
  }

  const required = items.filter((i) => i.isRequired);
  const optional = items.filter((i) => !i.isRequired);
  const uploadedCount = items.filter((i) => ["UPLOADED", "APPROVED"].includes(i.status)).length;

  return (
    <div className="space-y-6">
      <div>
        <a href={`/portal/${token}`} className="text-sm text-primary hover:underline">
          ← 포털 홈
        </a>
        <h1 className="text-2xl font-bold mt-2">진행 체크리스트</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {uploadedCount} / {items.length}개 서류 완료
        </p>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: items.length > 0 ? `${Math.round((uploadedCount / items.length) * 100)}%` : "0%" }}
        />
      </div>

      {required.length > 0 && (
        <section>
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
            필수 서류 ({required.length}개)
          </h2>
          <div className="space-y-2">
            {required.map((item) => (
              <ChecklistRow key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {optional.length > 0 && (
        <section>
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
            선택 서류 ({optional.length}개)
          </h2>
          <div className="space-y-2">
            {optional.map((item) => (
              <ChecklistRow key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {items.length === 0 && (
        <p className="text-muted-foreground text-center py-12">등록된 서류가 없습니다.</p>
      )}
    </div>
  );
}

function ChecklistRow({ item }: { item: ChecklistItem }) {
  const cfg = STATUS_CONFIG[item.status] ?? {
    label: item.status,
    className: "bg-muted text-foreground",
    icon: "·",
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
      <span className="mt-0.5 text-lg">{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm">{item.name}</p>
          {item.isRequired && (
            <span className="text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5">
              필수
            </span>
          )}
          <span className={`text-xs rounded-full px-2 py-0.5 ${cfg.className}`}>{cfg.label}</span>
        </div>
        {item.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
        )}
        {item.uploadedAt && (
          <p className="text-xs text-muted-foreground mt-0.5">
            업로드: {new Date(item.uploadedAt).toLocaleDateString("ko-KR")}
          </p>
        )}
      </div>
    </div>
  );
}
