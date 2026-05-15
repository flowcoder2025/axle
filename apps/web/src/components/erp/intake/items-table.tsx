"use client";

/**
 * ItemsTable — Editable line-item grid for /erp/intake/[draftId].
 *
 * Phase 20 WI-713a scope: plain text/number inputs for productName / qty /
 * unitPrice, row delete, and an "add row" footer. Autocomplete + per-row
 * shouldRegister toggle land in WI-713b.
 *
 * The `suggestions` prop is accepted (and currently unused) so this
 * component's external contract stays stable when 713b layers the
 * matchSuggestions UI on top.
 *
 * `disabled` reflects the parent's "draft is no longer PENDING or a submit
 * is in flight" state — when set, the inputs become read-only and the
 * add/delete affordances are hidden so the page reads as a confirmed
 * snapshot rather than an editable form.
 */
import type { Dispatch, SetStateAction } from "react";

export interface IntakeReviewItem {
  productId: string | null;
  productName: string;
  sku: string | null;
  qty: number;
  unitPrice: number;
  unit: string;
  shouldRegister: boolean;
}

/** Shape of one match suggestion. Kept loose; the consumer (WI-713b) will narrow. */
export interface ItemMatchSuggestion {
  productId?: string | null;
  productName?: string | null;
  score?: number;
}

interface ItemsTableProps {
  items: IntakeReviewItem[];
  setItems: Dispatch<SetStateAction<IntakeReviewItem[]>>;
  suggestions?: ItemMatchSuggestion[][];
  disabled?: boolean;
}

const CURRENCY_FMT = new Intl.NumberFormat("ko-KR");

function blankItem(): IntakeReviewItem {
  return {
    productId: null,
    productName: "",
    sku: null,
    qty: 1,
    unitPrice: 0,
    unit: "개",
    shouldRegister: true,
  };
}

export function ItemsTable({
  items,
  setItems,
  suggestions: _suggestions,
  disabled = false,
}: ItemsTableProps) {
  function updateAt(index: number, patch: Partial<IntakeReviewItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeAt(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function addRow() {
    setItems((prev) => [...prev, blankItem()]);
  }

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2">상품명</th>
            <th className="px-3 py-2 text-right">수량</th>
            <th className="px-3 py-2 text-right">단가</th>
            <th className="px-3 py-2 text-right">합계</th>
            <th className="px-3 py-2" aria-label="삭제" />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="px-3 py-6 text-center text-xs text-muted-foreground"
              >
                품목이 없습니다. 아래 &quot;품목 추가&quot;로 등록하세요.
              </td>
            </tr>
          ) : (
            items.map((it, i) => {
              const lineTotal = it.qty * it.unitPrice;
              return (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={it.productName}
                      onChange={(e) =>
                        updateAt(i, { productName: e.target.value })
                      }
                      disabled={disabled}
                      aria-label={`품목 ${i + 1} 상품명`}
                      className="w-full rounded border px-2 py-1 text-sm disabled:bg-muted disabled:text-muted-foreground"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={it.qty}
                      onChange={(e) =>
                        updateAt(i, { qty: Number(e.target.value) || 0 })
                      }
                      disabled={disabled}
                      aria-label={`품목 ${i + 1} 수량`}
                      className="w-20 rounded border px-2 py-1 text-right text-sm tabular-nums disabled:bg-muted disabled:text-muted-foreground"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={it.unitPrice}
                      onChange={(e) =>
                        updateAt(i, { unitPrice: Number(e.target.value) || 0 })
                      }
                      disabled={disabled}
                      aria-label={`품목 ${i + 1} 단가`}
                      className="w-28 rounded border px-2 py-1 text-right text-sm tabular-nums disabled:bg-muted disabled:text-muted-foreground"
                    />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {CURRENCY_FMT.format(lineTotal)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeAt(i)}
                      disabled={disabled}
                      aria-label={`품목 ${i + 1} 삭제`}
                      className="rounded px-2 py-1 text-sm text-muted-foreground hover:text-red-600 disabled:opacity-50"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        <tfoot>
          <tr className="border-t">
            <td colSpan={5} className="px-3 py-2">
              <button
                type="button"
                onClick={addRow}
                disabled={disabled}
                className="text-xs text-blue-600 hover:underline disabled:opacity-50 disabled:no-underline"
              >
                + 품목 추가
              </button>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
