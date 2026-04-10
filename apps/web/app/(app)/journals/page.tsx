import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { Button } from "@axle/ui";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { JournalTable } from "../../../src/components/journals/journal-table";
import { Prisma } from "@prisma/client";

export const metadata = {
  title: "연구일지 | AXLE",
};

interface SearchParams {
  clientId?: string;
  researcherContactId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: string;
  pageSize?: string;
}

interface JournalsPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function JournalsPage({ searchParams }: JournalsPageProps) {
  const user = await getCurrentUser();
  if (!user?.orgId) notFound();

  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize ?? "20") || 20));
  const skip = (page - 1) * pageSize;

  const clientId = params.clientId?.trim() || undefined;
  const researcherContactId = params.researcherContactId?.trim() || undefined;
  const status = params.status?.trim() || undefined;
  const dateFrom = params.dateFrom ? new Date(params.dateFrom) : undefined;
  const dateTo = params.dateTo ? new Date(params.dateTo + "T23:59:59") : undefined;

  const validStatuses = ["DRAFT", "SUBMITTED", "APPROVED"];
  const statusFilter =
    status && validStatuses.includes(status)
      ? (status as "DRAFT" | "SUBMITTED" | "APPROVED")
      : undefined;

  const where: Prisma.ResearchJournalWhereInput = {
    client: { orgId: user.orgId },
    ...(clientId ? { clientId } : {}),
    ...(researcherContactId ? { researcherContactId } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(dateFrom || dateTo
      ? {
          date: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: dateTo } : {}),
          },
        }
      : {}),
  };

  const [journals, total] = await Promise.all([
    prisma.researchJournal.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { date: "desc" },
      select: {
        id: true,
        title: true,
        date: true,
        status: true,
        hours: true,
        approvedAt: true,
        client: { select: { id: true, name: true } },
        researcher: { select: { id: true, name: true, position: true } },
      },
    }),
    prisma.researchJournal.count({ where }),
  ]);

  const serializedJournals = journals.map((j) => ({
    ...j,
    date: j.date.toISOString(),
    approvedAt: j.approvedAt ? j.approvedAt.toISOString() : null,
    hours: j.hours ? Number(j.hours) : null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">연구일지</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            연구자의 연구일지를 기록하고 승인 관리합니다.
          </p>
        </div>
        <Button asChild>
          <Link href="/journals/new">
            <Plus className="mr-2 h-4 w-4" />
            연구일지 추가
          </Link>
        </Button>
      </div>

      <Suspense
        fallback={
          <div className="py-8 text-center text-muted-foreground">
            불러오는 중...
          </div>
        }
      >
        <JournalTable
          journals={serializedJournals}
          total={total}
          page={page}
          pageSize={pageSize}
          currentClientId={params.clientId}
          currentResearcherId={params.researcherContactId}
          currentStatus={params.status}
          currentDateFrom={params.dateFrom}
          currentDateTo={params.dateTo}
        />
      </Suspense>
    </div>
  );
}
