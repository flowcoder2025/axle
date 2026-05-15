"use client";

/**
 * ItemsTable — Editable line-item grid for /erp/intake/[draftId].
 *
 * Phase 20 WI-713b: the productName input is now a ProductAutocomplete that
 * seeds from matchSuggestions and live-searches /api/erp/products. Each row
 * gets a "신규 등록 시" checkbox (`shouldRegister`) that decides whether the
 * confirm endpoint creates a Product row when productId is null.
 *
 * `disabled` reflects the parent's "draft is no longer PENDING or a submit
 * is in flight" state — when set, the inputs become read-only and the
 * add/delete affordances are hidden so the page reads as a confirmed
 * snapshot rather than an editable form.
 */
import type { Dispatch, SetStateAction } from "react";
import {
  ProductAutocomplete,
  type ProductSeedCandidate,
  type ProductSelection,
} from "./product-autocomplete";

export interface IntakeReviewItem {
  productId: string | null;
  productName: string;
  sku: string | null;
  qty: number;
  unitPrice: number;
  unit: string;
  shouldRegister: boolean;
}

/**
 * One entry from `matchSuggestions.items[i]` produced by the intake upload
 * route. `candidates` are fuzzy-match top-N over the org's Product list.
 */
export interface ItemMatchSuggestion {
  query: string;
  candidates: ProductSeedCandidate[];
}

interface ItemsTableProps {
  items: IntakeReviewItem[];
  setItems: Dispatch<SetStateAction<IntakeReviewItem[]>>;
  suggestions?: ItemMatchSuggestion[];
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
  suggestions = [],
  disabled = false,
}: ItemsTableProps) {
  function updateAt(index: number, patch: Partial<IntakeReviewItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function applyProductSelection(index: number, sel: ProductSelection) {
    updateAt(index, {
      productId: sel.productId,
      productName: sel.productName,
      sku: sel.sku,
      unit: sel.unit,
      // Don't trample a user-edited unitPrice with 0 when they're typing a
      // brand-new name (productId === null && unitPrice === 0). Only adopt
      // the suggestion's price when the user picked an existing product.
      ...(sel.productId !== null ? { unitPrice: sel.unitPrice } : {}),
    });
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
            <th className="px-3 py-2 text-center">신규 등록 시</th>
            <th className="px-3 py-2" aria-label="삭제" />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="px-3 py-6 text-center text-xs text-muted-foreground"
              >
                품목이 없습니다. 아래 &quot;품목 추가&quot;로 등록하세요.
              </td>
            </tr>
          ) : (
            items.map((it, i) => {
              const lineTotal = it.qty * it.unitPrice;
              const rowSuggestions = suggestions[i]?.candidates ?? [];
              const isExistingMatch = it.productId !== null;
              return (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2">
                    <ProductAutocomplete
                      value={it.productName}
                      initialSuggestions={rowSuggestions}
                      onChange={(sel) => applyProductSelection(i, sel)}
                      disabled={disabled}
                      ariaLabel={`품목 ${i + 1} 상품명`}
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
                  <td className="px-3 py-2 text-center">
                    {/*
                      When productId is set we matched an existing product;
                      the flag is moot (no creation happens). We still render
                      the checkbox so the UI is consistent, but disable it.
                    */}
                    <input
                      type="checkbox"
                      checked={it.shouldRegister}
                      onChange={(e) =>
                        updateAt(i, { shouldRegister: e.target.checked })
                      }
                      disabled={disabled || isExistingMatch}
                      aria-label={`품목 ${i + 1} 신규 등록`}
                      title={
                        isExistingMatch
                          ? "기존 상품과 매칭됨"
                          : "체크 시 신규 상품으로 등록"
                      }
                      className="h-4 w-4 disabled:opacity-50"
                    />
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
            <td colSpan={6} className="px-3 py-2">
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
