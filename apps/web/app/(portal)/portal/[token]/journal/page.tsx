import { notFound } from "next/navigation";

interface PortalJournal {
  id: string;
  title: string;
  content: string;
  submittedAt: string;
}

async function getJournals(token: string): Promise<PortalJournal[] | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/portal/${token}/journal`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = await res.json() as { data: PortalJournal[] };
  return json.data;
}

type Props = { params: Promise<{ token: string }> };

export default async function PortalJournalPage({ params }: Props) {
  const { token } = await params;
  const journals = await getJournals(token);

  if (journals === null) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <a href={`/portal/${token}`} className="text-sm text-primary hover:underline">
          ← 포털 홈
        </a>
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-2xl font-bold">연구 일지</h1>
          <a
            href={`/portal/${token}/journal/new`}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            + 새 일지 작성
          </a>
        </div>
      </div>

      {journals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-4xl mb-2">📝</p>
          <p className="font-medium">아직 작성된 일지가 없습니다</p>
          <p className="text-sm text-muted-foreground mt-1">
            첫 번째 연구 일지를 작성해 보세요
          </p>
          <a
            href={`/portal/${token}/journal/new`}
            className="mt-4 inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent transition-colors"
          >
            일지 작성하기
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {journals.map((j) => (
            <div key={j.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold">{j.title}</h2>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(j.submittedAt).toLocaleDateString("ko-KR")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-3">{j.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
