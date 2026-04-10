"use client";

import { useState } from "react";
import { Button } from "@axle/ui";

interface FinancialFormProps {
  clientId: string;
  onSuccess?: () => void;
}

const FIELDS: Array<{ key: string; label: string; required?: boolean }> = [
  { key: "year", label: "연도", required: true },
  { key: "revenue", label: "매출액" },
  { key: "operatingProfit", label: "영업이익" },
  { key: "netProfit", label: "당기순이익" },
  { key: "totalAssets", label: "자산총계" },
  { key: "totalLiabilities", label: "부채총계" },
  { key: "totalEquity", label: "자본총계" },
  { key: "creditRating", label: "신용등급" },
  { key: "source", label: "출처" },
];

export function FinancialForm({ clientId, onSuccess }: FinancialFormProps) {
  const [form, setForm] = useState<Record<string, string>>({
    year: String(new Date().getFullYear() - 1),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form)) {
        if (v === "") continue;
        if (k === "year" || FIELDS.some((f) => f.key === k && !["creditRating", "source"].includes(k))) {
          const n = Number(v);
          body[k] = k === "creditRating" || k === "source" ? v : isNaN(n) ? v : n;
        } else {
          body[k] = v;
        }
      }
      // Ensure numeric year
      if (form.year) body.year = parseInt(form.year, 10);

      const res = await fetch(`/api/clients/${clientId}/financials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "저장에 실패했습니다.");
      }

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <div key={field.key} className="space-y-1">
            <label className="text-sm font-medium" htmlFor={field.key}>
              {field.label}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <input
              id={field.key}
              type="text"
              value={form[field.key] ?? ""}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
              }
              required={field.required}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder={
                ["year"].includes(field.key)
                  ? "숫자 입력"
                  : ["creditRating", "source"].includes(field.key)
                  ? "문자 입력"
                  : "금액 (원)"
              }
            />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? "저장 중..." : "저장"}
        </Button>
      </div>
    </form>
  );
}
