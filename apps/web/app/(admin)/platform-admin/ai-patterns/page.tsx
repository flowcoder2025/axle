import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import { AiPatternsAdmin } from "@/src/components/admin/ai-patterns-admin";

type Props = {
  searchParams: Promise<{
    candidatesOnly?: "true" | "false";
    taskType?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function AiPatternsAdminPage({ searchParams }: Props) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const candidatesOnly = sp.candidatesOnly === "true";

  const where: Record<string, unknown> = {};
  if (candidatesOnly) {
    where.successCount = { gte: 10 };
    where.isFineTuned = false;
  }
  if (sp.taskType) where.taskType = sp.taskType;

  const [patterns, total, candidateCount, avgCostRows] = await Promise.all([
    prisma.skillPattern.findMany({
      where,
      orderBy: [{ successCount: "desc" }, { lastUsedAt: "desc" }],
      take: 100,
    }),
    prisma.skillPattern.count({ where }),
    prisma.skillPattern.count({
      where: { successCount: { gte: 10 }, isFineTuned: false },
    }),
    // Average cost per taskType (last 50 jobs) — approximates per-pattern economics
    prisma.aiJob.groupBy({
      by: ["type"],
      where: { status: "COMPLETED", cost: { not: null } },
      _avg: { cost: true },
    }),
  ]);

  const avgCostByType = new Map<string, number>();
  for (const row of avgCostRows) {
    if (row._avg.cost !== null) {
      avgCostByType.set(row.type, Number(row._avg.cost));
    }
  }

  const rows = patterns.map((p) => ({
    id: p.id,
    name: p.name,
    taskType: p.taskType,
    successCount: p.successCount,
    isFineTuned: p.isFineTuned,
    status: p.status,
    errorMessage: p.errorMessage,
    loraAdapterUrl: p.loraAdapterUrl,
    lastUsedAt: p.lastUsedAt?.toISOString() ?? null,
    fineTuneStartedAt: p.fineTuneStartedAt?.toISOString() ?? null,
    fineTuneCompletedAt: p.fineTuneCompletedAt?.toISOString() ?? null,
    promotedAt: p.promotedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    avgCost: avgCostByType.get(p.taskType) ?? null,
    sampleInput: p.sampleInput,
    sampleOutput: p.sampleOutput,
    inputSchema: p.inputSchema,
    outputSchema: p.outputSchema,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI 패턴</h1>
        <p className="text-sm text-muted-foreground">
          누적된 SkillPattern을 관리하고 LOCAL_MLX 파인튜닝을 승격합니다.
        </p>
      </div>

      <AiPatternsAdmin
        patterns={rows}
        total={total}
        candidateCount={candidateCount}
        currentFilter={{
          candidatesOnly,
          taskType: sp.taskType ?? null,
        }}
      />
    </div>
  );
}
