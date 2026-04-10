import { notFound } from "next/navigation";

interface PortalProject {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  type: string;
  priority: string;
}

interface PortalClient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface PortalData {
  tokenId: string;
  scope: "FULL" | "UPLOAD" | "JOURNAL";
  project: PortalProject;
  client: PortalClient | null;
  expiresAt: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  INTAKE: "접수",
  DOC_COLLECTING: "서류 수집 중",
  IN_PROGRESS: "진행 중",
  REVIEW: "검토 중",
  SUBMITTED: "제출 완료",
  APPROVED: "승인",
  REJECTED: "반려",
  COMPLETED: "완료",
};

async function getPortalData(token: string): Promise<PortalData | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/portal/${token}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = await res.json() as { data: PortalData };
  return json.data;
}

type Props = { params: Promise<{ token: string }> };

export default async function PortalPage({ params }: Props) {
  const { token } = await params;
  const data = await getPortalData(token);

  if (!data) {
    notFound();
  }

  const { project, client, scope, expiresAt } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{project.title}</h1>
        {client && (
          <p className="text-muted-foreground mt-1">{client.name}</p>
        )}
      </div>

      {/* Project status card */}
      <div className="rounded-lg border bg-card p-5 space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">프로젝트 현황</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">상태</p>
            <p className="font-medium">{STATUS_LABELS[project.status] ?? project.status}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">마감일</p>
            <p className="font-medium">
              {project.dueDate
                ? new Date(project.dueDate).toLocaleDateString("ko-KR")
                : "미정"}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation cards */}
      <div className="grid gap-3">
        {(scope === "FULL" || scope === "UPLOAD") && (
          <>
            <a
              href={`/portal/${token}/upload`}
              className="flex items-center gap-4 rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
            >
              <span className="text-2xl">📎</span>
              <div>
                <p className="font-medium">서류 업로드</p>
                <p className="text-sm text-muted-foreground">필요 서류를 업로드해 주세요</p>
              </div>
            </a>
            <a
              href={`/portal/${token}/checklist`}
              className="flex items-center gap-4 rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
            >
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-medium">진행 체크리스트</p>
                <p className="text-sm text-muted-foreground">서류 준비 현황을 확인하세요</p>
              </div>
            </a>
          </>
        )}
        {(scope === "FULL" || scope === "JOURNAL") && (
          <a
            href={`/portal/${token}/journal`}
            className="flex items-center gap-4 rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
          >
            <span className="text-2xl">📝</span>
            <div>
              <p className="font-medium">연구 일지</p>
              <p className="text-sm text-muted-foreground">연구 활동을 기록하세요</p>
            </div>
          </a>
        )}
      </div>

      {expiresAt && (
        <p className="text-xs text-muted-foreground text-center">
          이 링크는 {new Date(expiresAt).toLocaleDateString("ko-KR")}까지 유효합니다.
        </p>
      )}
    </div>
  );
}
