"use client";

import { useState } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Badge,
} from "@axle/ui";
import { ChevronDown, ChevronRight } from "lucide-react";
import { FeedbackForm } from "./feedback-form";

export interface MatchResultRow {
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
}

interface MatchingResultsProps {
  results: MatchResultRow[];
  onFeedbackSaved?: (matchId: string, isRelevant: boolean) => void;
}

function ScoreBar({ score, isDisqualified }: { score: number; isDisqualified: boolean }) {
  if (isDisqualified) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-0 bg-destructive" />
        </div>
        <span className="text-xs text-muted-foreground">실격</span>
      </div>
    );
  }

  const color =
    score >= 70 ? "bg-green-500" : score >= 40 ? "bg-yellow-400" : "bg-orange-400";

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="min-w-[2.5rem] text-xs font-medium tabular-nums">{score}점</span>
    </div>
  );
}

function StatusBadge({ isDisqualified, score }: { isDisqualified: boolean; score: number }) {
  if (isDisqualified) {
    return <Badge variant="destructive">실격</Badge>;
  }
  if (score >= 70) {
    return <Badge className="bg-green-600 text-white hover:bg-green-600">추천</Badge>;
  }
  if (score >= 40) {
    return <Badge variant="secondary">검토</Badge>;
  }
  return <Badge variant="outline">낮음</Badge>;
}

export function MatchingResults({ results, onFeedbackSaved }: MatchingResultsProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (results.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        매칭 결과가 없습니다. 매칭을 실행해 주세요.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>프로그램명</TableHead>
            <TableHead>점수</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>주요 매칭 사유</TableHead>
            <TableHead className="w-32">피드백</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((r) => {
            const rowKey = r.programId;
            const isExpanded = expandedIds.has(rowKey);
            const rowClass = r.isDisqualified ? "opacity-50" : "";

            return (
              <>
                <TableRow
                  key={rowKey}
                  className={`cursor-pointer ${rowClass} hover:bg-muted/50`}
                  onClick={() => toggleExpand(rowKey)}
                >
                  <TableCell>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{r.programName}</TableCell>
                  <TableCell>
                    <ScoreBar score={r.score} isDisqualified={r.isDisqualified} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge isDisqualified={r.isDisqualified} score={r.score} />
                  </TableCell>
                  <TableCell className="max-w-[280px]">
                    {r.isDisqualified ? (
                      <span className="text-xs text-destructive line-clamp-1">
                        {r.disqualifyReasons[0] ?? "자격 요건 미충족"}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {r.matchReasons[0] ?? "—"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {r.id && (
                      <FeedbackForm
                        matchId={r.id}
                        initialIsRelevant={r.isRelevant}
                        initialNote={r.feedbackNote}
                        onSaved={onFeedbackSaved}
                      />
                    )}
                  </TableCell>
                </TableRow>

                {isExpanded && (
                  <TableRow key={`${rowKey}-detail`} className={rowClass}>
                    <TableCell />
                    <TableCell colSpan={5} className="bg-muted/20 py-3">
                      <div className="space-y-2 text-sm">
                        {r.isDisqualified ? (
                          <div>
                            <p className="mb-1 font-medium text-destructive">실격 사유</p>
                            <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                              {r.disqualifyReasons.map((reason, i) => (
                                <li key={i}>{reason}</li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <>
                            {r.matchReasons.length > 0 && (
                              <div>
                                <p className="mb-1 font-medium text-green-700">매칭 사유</p>
                                <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                                  {r.matchReasons.map((reason, i) => (
                                    <li key={i}>{reason}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {r.penalties.length > 0 && (
                              <div>
                                <p className="mb-1 font-medium text-orange-600">감점 항목</p>
                                <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                                  {r.penalties.map((p, i) => (
                                    <li key={i}>
                                      {p.reason}{" "}
                                      <span className="text-orange-500">(-{p.points}점)</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
