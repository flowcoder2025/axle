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

export const metadata = {
  title: "AI 설정 | AXLE",
};

const SKILL_PATTERN_STATS = [
  { name: "제안서 작성", usageCount: 0, successRate: "—" },
  { name: "계약서 요약", usageCount: 0, successRate: "—" },
  { name: "일정 최적화", usageCount: 0, successRate: "—" },
] as const;

export default function AISettingsPage() {
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
          <CardTitle>스킬 패턴 통계</CardTitle>
          <CardDescription>
            AI가 처리한 스킬 패턴의 사용 현황입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y rounded-lg border">
            <div className="grid grid-cols-3 px-4 py-2 text-xs font-medium text-muted-foreground">
              <span>패턴명</span>
              <span className="text-center">사용 횟수</span>
              <span className="text-right">성공률</span>
            </div>
            {SKILL_PATTERN_STATS.map((pattern) => (
              <div
                key={pattern.name}
                className="grid grid-cols-3 items-center px-4 py-3 text-sm"
              >
                <span className="font-medium">{pattern.name}</span>
                <span className="text-center">
                  <Badge variant="secondary">{pattern.usageCount}</Badge>
                </span>
                <span className="text-right text-muted-foreground">
                  {pattern.successRate}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            실제 통계는 AI 기능 구현 후 표시됩니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
