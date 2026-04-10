import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { Button, Badge, Card, CardContent, CardHeader, CardTitle } from "@axle/ui";
import { ArrowLeft, Pencil } from "lucide-react";
import { ApprovalPanel } from "../../../../src/components/journals/approval-panel";
import { AiDraftButton } from "../../../../src/components/journals/ai-draft-button";
import { JournalForm } from "../../../../src/components/journals/journal-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ journalId: string }>;
}) {
  const { journalId } = await params;
  const journal = await prisma.researchJournal.findFirst({
    where: { id: journalId },
    select: { title: true },
  });
  return {
    title: journal ? `${journal.title} | AXLE` : "연구일지 상세 | AXLE",
  };
}

interface PageProps {
  params: Promise<{ journalId: string }>;
  searchParams: Promise<{ edit?: string }>;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "초안",
  SUBMITTED: "제출됨",
  APPROVED: "승인됨",
};

const STATUS_VARIANTS: Record<
  string,
  "outline" | "secondary" | "default" | "destructive"
> = {
  DRAFT: "outline",
  SUBMITTED: "secondary",
  APPROVED: "default",
};

export default async function JournalDetailPage({ params, searchParams }: PageProps) {
  const user = await getCurrentUser();
  const { journalId } = await params;
  const { edit } = await searchParams;

  if (!user?.orgId) notFound();

  const journal = await prisma.researchJournal.findFirst({
    where: { id: journalId, client: { orgId: user.orgId } },
    include: {
      client: { select: { id: true, name: true } },
      researcher: { select: { id: true, name: true, position: true, email: true } },
    },
  });

  if (!journal) notFound();

  const isEditMode = edit === "1" && journal.status === "DRAFT";

  if (isEditMode) {
    const [clients, researchers] = await Promise.all([
      prisma.client.findMany({
        where: { orgId: user.orgId, status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.contact.findMany({
        where: {
          isResearcher: true,
          client: { orgId: user.orgId },
        },
        orderBy: [{ clientId: "asc" }, { name: "asc" }],
        select: { id: true, name: true, position: true, clientId: true },
      }),
    ]);

    return (
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href={`/journals/${journalId}`}
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            연구일지 상세
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">편집</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">연구일지 편집</h1>
        </div>

        <JournalForm
          clients={clients}
          researchers={researchers}
          mode="edit"
          initialData={{
            id: journal.id,
            clientId: journal.clientId,
            researcherContactId: journal.researcherContactId,
            date: journal.date.toISOString(),
            title: journal.title,
            content: journal.content,
            objectives: journal.objectives ?? undefined,
            results: journal.results ?? undefined,
            nextSteps: journal.nextSteps ?? undefined,
            hours: journal.hours ? Number(journal.hours) : null,
            status: journal.status,
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/journals"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          연구일지 목록
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{journal.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{journal.title}</h1>
            <Badge variant={STATUS_VARIANTS[journal.status] ?? "outline"}>
              {STATUS_LABELS[journal.status] ?? journal.status}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{journal.client.name}</span>
            <span>
              연구자: {journal.researcher.name}
              {journal.researcher.position && ` (${journal.researcher.position})`}
            </span>
            <span>{formatDate(journal.date)}</span>
            {journal.hours && <span>{Number(journal.hours)}시간</span>}
          </div>
        </div>
        {journal.status === "DRAFT" && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/journals/${journalId}?edit=1`}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                편집
              </Link>
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Content */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">연구 내용</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{journal.content}</p>
            </CardContent>
          </Card>

          {/* Objectives */}
          {journal.objectives && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">연구 목표</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{journal.objectives}</p>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {journal.results && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">연구 결과</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{journal.results}</p>
              </CardContent>
            </Card>
          )}

          {/* Next Steps */}
          {journal.nextSteps && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">차기 계획</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{journal.nextSteps}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Approval panel */}
          <ApprovalPanel
            journalId={journal.id}
            status={journal.status}
            approvedBy={journal.approvedBy}
            approvedAt={journal.approvedAt ? journal.approvedAt.toISOString() : null}
          />

          {/* AI Draft */}
          {journal.status === "DRAFT" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">AI 도구</CardTitle>
              </CardHeader>
              <CardContent>
                <AiDraftButton journalId={journal.id} />
                {journal.aiDraftJobId && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    AI 작업 ID: {journal.aiDraftJobId}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Meta */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">상세 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">고객사</span>
                <span>{journal.client.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">연구자</span>
                <span>{journal.researcher.name}</span>
              </div>
              {journal.researcher.email && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">이메일</span>
                  <span className="text-xs">{journal.researcher.email}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">날짜</span>
                <span>{formatDate(journal.date)}</span>
              </div>
              {journal.hours && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">연구 시간</span>
                  <span>{Number(journal.hours)}h</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">생성일</span>
                <span>
                  {new Date(journal.createdAt).toLocaleDateString("ko-KR")}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
