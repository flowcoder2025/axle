import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@axle/ui";
import { Button } from "@axle/ui";
import { Badge } from "@axle/ui";
import { prisma } from "@axle/db";

export const metadata = {
  title: "AI 설정 | AXLE",
};

async function getPatternStats() {
  const [patterns, total, candidateCount] = await Promise.all([
    prisma.skillPattern.findMany({
      orderBy: { successCount: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        taskType: true,
        successCount: true,
        lastUsedAt: true,
        isFineTuned: true,
      },
    }),
    prisma.skillPattern.count(),
    prisma.skillPattern.count({
      where: { successCount: { gte: 10 }, isFineTuned: false },
    }),
  ]);
  return { patterns, total, candidateCount };
}

export default async function AISettingsPage() {
  const { patterns, total, candidateCount } = await getPatternStats();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI 설정</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AI 동작 방식과 스킬 패턴을 관리합니다.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API 모드 강제</CardTitle>
          <CardDescription>
            활성화 시 AI 응답에서 스트리밍을 비활성화하고 전체 응답을 단일
            요청으로 처리합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="force-api-mode"
              className="h-4 w-4 cursor-not-allowed rounded border-input"
              disabled
            />
            <label htmlFor="force-api-mode" className="text-sm font-medium">
              forceApiMode 활성화
            </label>
          </div>
        </CardContent>
        <CardFooter>
          <Button disabled>저장</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>스킬 패턴 현황</CardTitle>
          <CardDescription>
            AI 작업 완료 시 자동으로 학습되는 스킬 패턴입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-6">
            <div className="rounded-lg border px-4 py-3 text-center">
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground">전체 패턴</p>
            </div>
            <div className="rounded-lg border px-4 py-3 text-center">
              <p className="text-2xl font-bold">{candidateCount}</p>
              <p className="text-xs text-muted-foreground">파인튜닝 후보</p>
            </div>
          </div>

          {patterns.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              아직 학습된 패턴이 없습니다. AI 작업이 완료되면 자동으로 쌓입니다.
            </p>
          ) : (
            <div className="divide-y rounded-lg border">
              <div className="grid grid-cols-4 px-4 py-2 text-xs font-medium text-muted-foreground">
                <span>패턴명</span>
                <span>작업 유형</span>
                <span className="text-center">성공 횟수</span>
                <span className="text-right">상태</span>
              </div>
              {patterns.map((pattern) => (
                <div
                  key={pattern.id}
                  className="grid grid-cols-4 items-center px-4 py-3 text-sm"
                >
                  <span className="font-medium">{pattern.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {pattern.taskType}
                  </span>
                  <span className="text-center">
                    <Badge
                      variant={
                        pattern.successCount >= 10 ? "default" : "secondary"
                      }
                    >
                      {pattern.successCount}
                    </Badge>
                  </span>
                  <span className="text-right">
                    {pattern.isFineTuned ? (
                      <Badge variant="default" className="bg-green-600 text-xs">
                        파인튜닝됨
                      </Badge>
                    ) : pattern.successCount >= 10 ? (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-600">
                        후보
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        학습 중
                      </Badge>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
