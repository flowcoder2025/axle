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
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Report[]>(reports);

  const handleGenerate = async () => {
    if (!selectedYear) return;
    setLoading(true);
    setError(null);

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
          <Button onClick={handleGenerate} disabled={loading || !selectedYear} size="sm">
            {loading ? "생성 중..." : "DOCX 보고서 생성"}
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

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
