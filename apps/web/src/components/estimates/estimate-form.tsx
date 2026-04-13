"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Card, CardContent, CardFooter, CardHeader, CardTitle } from "@axle/ui";

interface EstimateItem {
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface ClientOption {
  id: string;
  name: string;
}

interface EstimateFormProps {
  clients: ClientOption[];
  defaultClientId?: string;
  mode?: "create" | "edit";
  estimateId?: string;
  initialData?: {
    clientId?: string;
    validUntil?: string;
    items?: EstimateItem[];
  };
}

const EMPTY_ITEM: EstimateItem = {
  name: "",
  quantity: 1,
  unitPrice: 0,
  amount: 0,
};

const selectCn =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function EstimateForm({ clients, defaultClientId = "", mode = "create", estimateId, initialData }: EstimateFormProps) {
  const router = useRouter();
  const [clientId, setClientId] = useState(initialData?.clientId ?? defaultClientId);
  const [validUntil, setValidUntil] = useState(initialData?.validUntil ?? "");
  const [items, setItems] = useState<EstimateItem[]>(
    initialData?.items && initialData.items.length > 0
      ? initialData.items
      : [{ ...EMPTY_ITEM }]
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = Math.round(totalAmount * 0.1);

  function updateItem(idx: number, field: keyof EstimateItem, value: string | number) {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[idx], [field]: value };
      // Auto-calculate amount when quantity or unitPrice changes
      if (field === "quantity" || field === "unitPrice") {
        item.amount = item.quantity * item.unitPrice;
      }
      next[idx] = item;
      return next;
    });
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clientId) {
      setError("고객사를 선택해주세요.");
      return;
    }
    if (items.some((item) => !item.name)) {
      setError("모든 항목에 품목명을 입력해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const url = mode === "create" ? "/api/estimates" : `/api/estimates/${estimateId}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          items,
          totalAmount,
          taxAmount,
          validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message ?? "오류가 발생했습니다.");
        return;
      }

      const data = await res.json();
      router.push(`/estimates/${data.data?.id ?? estimateId}`);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="clientId">고객사 *</Label>
            <select
              id="clientId"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={selectCn}
              required
            >
              <option value="">고객사 선택</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="validUntil">유효기간</Label>
            <Input
              id="validUntil"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>견적 항목</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="pb-2 text-left font-medium w-[40%]">품목명</th>
                  <th className="pb-2 text-right font-medium w-[15%]">수량</th>
                  <th className="pb-2 text-right font-medium w-[20%]">단가</th>
                  <th className="pb-2 text-right font-medium w-[20%]">금액</th>
                  <th className="pb-2 w-[5%]"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2 pr-2">
                      <Input
                        value={item.name}
                        onChange={(e) => updateItem(idx, "name", e.target.value)}
                        placeholder="품목명"
                        required
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(idx, "quantity", Number(e.target.value))
                        }
                        className="text-right"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        type="number"
                        min={0}
                        value={item.unitPrice}
                        onChange={(e) =>
                          updateItem(idx, "unitPrice", Number(e.target.value))
                        }
                        className="text-right"
                      />
                    </td>
                    <td className="py-2 px-2 text-right font-medium">
                      {item.amount.toLocaleString("ko-KR")}원
                    </td>
                    <td className="py-2 pl-2">
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeItem(idx)}
                        >
                          삭제
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t">
                  <td colSpan={3} className="pt-3 text-right font-medium">
                    공급가액
                  </td>
                  <td className="pt-3 text-right font-medium">
                    {totalAmount.toLocaleString("ko-KR")}원
                  </td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={3} className="py-1 text-right text-muted-foreground">
                    부가세 (10%)
                  </td>
                  <td className="py-1 text-right text-muted-foreground">
                    {taxAmount.toLocaleString("ko-KR")}원
                  </td>
                  <td></td>
                </tr>
                <tr className="border-t">
                  <td colSpan={3} className="pt-2 text-right font-bold">
                    합계
                  </td>
                  <td className="pt-2 text-right font-bold text-primary">
                    {(totalAmount + taxAmount).toLocaleString("ko-KR")}원
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            + 항목 추가
          </Button>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "저장 중..." : mode === "create" ? "견적서 생성" : "변경 저장"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/estimates")}
        >
          취소
        </Button>
      </div>
    </form>
  );
}
