"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@axle/ui";
import { PlayCircle, Loader2 } from "lucide-react";
import { toast } from "@axle/ui";
import { MatchingResults } from "./matching-results";
import type { MatchResultRow } from "./matching-results";

interface ClientOption {
  id: string;
  name: string;
  industry: string | null;
  region: string | null;
}

interface MatchingDashboardProps {
  clients: ClientOption[];
  selectedClientId: string | null;
  initialResults: MatchResultRow[];
}

export function MatchingDashboard({
  clients,
  selectedClientId: initialClientId,
  initialResults,
}: MatchingDashboardProps) {
  const router = useRouter();
  const [clientId, setClientId] = useState<string>(initialClientId ?? "");
  const [results, setResults] = useState<MatchResultRow[]>(initialResults);
  const [running, startTransition] = useTransition();

  function handleClientChange(id: string) {
    setClientId(id);
    setResults([]);
    if (id) {
      router.push(`/matching?clientId=${id}`);
    } else {
      router.push("/matching");
    }
  }

  async function runMatching() {
    if (!clientId) return;
    startTransition(async () => {
      try {
        const res = await fetch("/api/matching", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId }),
        });

        if (!res.ok) {
          const { error } = await res.json();
          toast.error("매칭 실행 실패", { description: error?.message ?? "오류가 발생했습니다." });
          return;
        }

        const { data } = await res.json();
        setResults(
          (data as Array<{
            id: string | null;
            programId: string;
            programName: string;
            programCategory?: string;
            score: number;
            isDisqualified: boolean;
            disqualifyReasons: string[];
            penalties: Array<{ reason: string; points: number }>;
            matchReasons: string[];
            isRelevant: boolean | null;
            feedbackNote: string | null;
          }>).map((r) => ({
            id: r.id,
            programId: r.programId,
            programName: r.programName,
            programCategory: r.programCategory,
            score: r.score,
            isDisqualified: r.isDisqualified,
            disqualifyReasons: r.disqualifyReasons,
            penalties: r.penalties,
            matchReasons: r.matchReasons,
            isRelevant: r.isRelevant,
            feedbackNote: r.feedbackNote,
          }))
        );

        const qualified = (data as MatchResultRow[]).filter((r) => !r.isDisqualified).length;
        toast.success("매칭 완료", {
          description: `${data.length}개 프로그램 분석 완료 (적합 ${qualified}개)`,
        });
      } catch {
        toast.error("서버 오류", { description: "서버 오류가 발생했습니다." });
      }
    });
  }

  const selectedClient = clients.find((c) => c.id === clientId);

  return (
    <div className="space-y-6">
      {/* Client selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">고객사 선택</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              고객사
            </label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={clientId}
              onChange={(e) => handleClientChange(e.target.value)}
            >
              <option value="">고객사를 선택하세요</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.industry ? ` · ${c.industry}` : ""}
                  {c.region ? ` · ${c.region}` : ""}
                </option>
              ))}
            </select>
          </div>

          <Button
            disabled={!clientId || running}
            onClick={runMatching}
            className="flex items-center gap-2 sm:w-auto"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            {running ? "분석 중..." : "매칭 실행"}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              매칭 결과
              {selectedClient && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  — {selectedClient.name}
                </span>
              )}
            </h2>
            <div className="flex gap-3 text-sm text-muted-foreground">
              <span className="text-green-600 font-medium">
                추천 {results.filter((r) => !r.isDisqualified && r.score >= 70).length}개
              </span>
              <span>
                검토 {results.filter((r) => !r.isDisqualified && r.score >= 40 && r.score < 70).length}개
              </span>
              <span className="text-destructive">
                실격 {results.filter((r) => r.isDisqualified).length}개
              </span>
            </div>
          </div>
          <MatchingResults
            results={results}
            onFeedbackSaved={(matchId, relevant) => {
              setResults((prev) =>
                prev.map((r) =>
                  r.id === matchId ? { ...r, isRelevant: relevant } : r
                )
              );
            }}
          />
        </div>
      )}

      {clientId && results.length === 0 && !running && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            매칭 실행 버튼을 눌러 분석을 시작하세요.
          </p>
        </div>
      )}
    </div>
  );
}
