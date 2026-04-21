"use client";

import { useState } from "react";
import { Button } from "@axle/ui";

interface Report {
  id: string;
  year: number;
  reportUrl?: string | null;
  createdAt: string;
}

interface ReportSectionProps {
  clientId: string;
  reports: Report[];
  availableYears: number[];
}

export function ReportSection({ clientId, reports, availableYears }: ReportSectionProps) {
  const [selectedYear, setSelectedYear] = useState<number | null>(
    availableYears[0] ?? null
  );
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Report[]>(reports);

  const handleGenerate = async () => {
    if (!selectedYear) return;
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(`/api/clients/${clientId}/financial-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: selectedYear }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "보고서 생성에 실패했습니다.");
      }

      const { data } = await res.json();
      setGenerated((prev) => [data.report, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAi = async () => {
    if (!selectedYear) return;
    setAiLoading(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(`/api/clients/${clientId}/financial-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: selectedYear }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(
          data.error?.message ?? "AI 재무 분석 리포트 생성에 실패했습니다.",
        );
      }

      const { data } = await res.json();
      const newReport: Report = {
        id: data.reportId,
        year: selectedYear,
        reportUrl: data.url,
        createdAt: new Date().toISOString(),
      };
      setGenerated((prev) => [
        newReport,
        ...prev.filter((r) => r.id !== newReport.id),
      ]);
      setNotice(
        data.fallbackUsed
          ? "AI 응답이 없어 자동 요약 템플릿으로 리포트를 생성했습니다."
          : "AI 재무 분석 리포트가 생성되었습니다.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Generate panel */}
      {availableYears.length > 0 && (
        <div className="flex items-center gap-3">
          <select
            value={selectedYear ?? ""}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-md border px-3 py-2 text-sm"
          >
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}년
              </option>
            ))}
          </select>
          <Button
            onClick={handleGenerate}
            disabled={loading || aiLoading || !selectedYear}
            size="sm"
          >
            {loading ? "생성 중..." : "DOCX 보고서 생성"}
          </Button>
          <Button
            onClick={handleGenerateAi}
            disabled={loading || aiLoading || !selectedYear}
            size="sm"
            variant="outline"
          >
            {aiLoading ? "AI 분석 중..." : "AI 재무 분석 리포트 생성"}
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
      {notice && <p className="text-sm text-emerald-600">{notice}</p>}

      {/* Reports list */}
      {generated.length === 0 ? (
        <p className="text-sm text-muted-foreground">생성된 보고서가 없습니다.</p>
      ) : (
        <div className="divide-y rounded-lg border">
          {generated.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{r.year}년 재무분석보고서</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleDateString("ko-KR")}
                </p>
              </div>
              {r.reportUrl && (
                <a
                  href={r.reportUrl}
                  download
                  className="text-sm text-primary hover:underline"
                >
                  다운로드
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
