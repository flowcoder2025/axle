import { notFound } from "next/navigation";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { Suspense } from "react";
import { MatchingDashboard } from "../../../src/components/matching/matching-dashboard";

export const metadata = {
  title: "매칭 분석 | AXLE",
};

interface SearchParams {
  clientId?: string;
}

interface MatchingPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function MatchingPage({ searchParams }: MatchingPageProps) {
  const user = await getCurrentUser();
  if (!user?.orgId) notFound();

  const params = await searchParams;
  const selectedClientId = params.clientId?.trim() || undefined;

  // Fetch all clients for selector
  const clients = await prisma.client.findMany({
    where: { orgId: user.orgId, status: "ACTIVE" },
    select: { id: true, name: true, industry: true, region: true },
    orderBy: { name: "asc" },
    take: 200,
  });

  // Pre-load existing results if a client is selected
  let initialResults: Array<{
    id: string;
    programId: string;
    programName: string;
    programCategory: string;
    score: number;
    matchReasons: string[];
    disqualifyReasons: string[];
    isDisqualified: boolean;
    penalties: Array<{ reason: string; points: number }>;
    isRelevant: boolean | null;
    feedbackNote: string | null;
    createdAt: string;
  }> = [];

  if (selectedClientId) {
    const clientExists = clients.some((c) => c.id === selectedClientId);
    if (clientExists) {
      const rows = await prisma.matchingResult.findMany({
        where: { clientId: selectedClientId },
        orderBy: { score: "desc" },
        include: {
          program: { select: { name: true, category: true } },
        },
      });
      initialResults = rows.map((r) => {
        const disqualifyReasons = (r.disqualifyReasons as string[]) ?? [];
        const score = Number(r.score);
        return {
          id: r.id,
          programId: r.programId,
          programName: r.program.name,
          programCategory: r.program.category,
          score,
          matchReasons: (r.matchReasons as string[]) ?? [],
          disqualifyReasons,
          isDisqualified: score === 0 && disqualifyReasons.length > 0,
          penalties: [],
          isRelevant: r.isRelevant,
          feedbackNote: r.feedbackNote,
          createdAt: r.createdAt.toISOString(),
        };
      });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">매칭 분석</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          고객사에 적합한 지원사업을 3단계 매칭 엔진으로 분석합니다.
        </p>
      </div>

      <Suspense fallback={<div className="py-8 text-center text-muted-foreground">불러오는 중...</div>}>
        <MatchingDashboard
          clients={clients}
          selectedClientId={selectedClientId ?? null}
          initialResults={initialResults}
        />
      </Suspense>
    </div>
  );
}
