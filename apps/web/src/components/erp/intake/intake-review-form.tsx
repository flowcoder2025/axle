"use client";

/**
 * IntakeReviewForm — Editable review for one IntakeDraft.
 *
 * Phase 20 WI-713a scope:
 *  - Left column: receipt image (sticky on desktop) for visual reference.
 *  - Right column: editable fields (유형 / 일자 / 거래처 / 품목 / 세금) +
 *    autoRegister toggle + 등록 / 폐기 actions.
 *
 * The 거래처 + 품목 autocomplete and matchSuggestions hookup land in WI-713b;
 * this file already accepts the `matchSuggestions` prop so 713b is a pure
 * additive change (no upstream breakage).
 *
 * Confirm payload contract: `POST /api/erp/intake/[draftId]/confirm`
 *   - 409 → "이미 등록됨" surfaced inline; submit re-enabled by the caller
 *     reloading the page (CONFIRMED drafts disable the form anyway).
 *   - 2xx → `router.push(/erp/orders/${orderId})`.
 *
 * Discard payload contract: `POST /api/erp/intake/[draftId]/discard`
 *   - On any non-409 outcome we navigate back to /erp/intake. 409 (e.g. the
 *     draft is no longer PENDING) is surfaced as an inline error and the
 *     form stays put so the user can see why.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@axle/ui";
import type { ReceiptData } from "@axle/ocr";
import {
  ItemsTable,
  type IntakeReviewItem,
  type ItemMatchSuggestion,
} from "./items-table";

export type IntakeOrderType = "SALE" | "PURCHASE";

export interface IntakeReviewFormProps {
  draftId: string;
  blobUrl: string;
  status: string;
  parsed: Partial<ReceiptData> | null;
  matchSuggestions: {
    items?: ItemMatchSuggestion[][];
    vendor?: ItemMatchSuggestion[];
  } | null;
  errorMsg: string | null;
  confirmedOrderId: string | null;
}

/** Body sent to `POST /api/erp/intake/[draftId]/confirm`. Matches the route's Zod schema. */
export interface ConfirmRequestBody {
  type: IntakeOrderType;
  counterpartyName: string;
  counterpartyId: string | null;
  occurredAt: string;
  total: number;
  tax: number;
  autoRegisterProducts: boolean;
  items: IntakeReviewItem[];
}

const CURRENCY_FMT = new Intl.NumberFormat("ko-KR");

/** Today as `YYYY-MM-DD` in the user's local timezone. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Map a parsed item (from `@axle/ocr` ReceiptData) into the form's row shape. */
function toReviewItems(parsed: IntakeReviewFormProps["parsed"]): IntakeReviewItem[] {
  const rawItems = parsed?.items;
  if (!Array.isArray(rawItems)) return [];
  return rawItems.map((it) => ({
    productId: null,
    productName: it.name ?? "",
    sku: null,
    qty: typeof it.qty === "number" && Number.isFinite(it.qty) ? it.qty : 1,
    unitPrice:
      typeof it.unitPrice === "number" && Number.isFinite(it.unitPrice)
        ? it.unitPrice
        : 0,
    unit: it.unit ?? "개",
    shouldRegister: true,
  }));
}

function deriveInitialType(parsed: IntakeReviewFormProps["parsed"]): IntakeOrderType {
  return parsed?.type === "sale" ? "SALE" : "PURCHASE";
}

function deriveInitialDate(parsed: IntakeReviewFormProps["parsed"]): string {
  const raw = parsed?.date;
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return todayIso();
}

function deriveInitialTax(parsed: IntakeReviewFormProps["parsed"]): number {
  const raw = parsed?.tax;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

/**
 * Pure helper for the confirm payload — exposed so unit tests can exercise
 * the request shape without rendering the component.
 */
export function buildConfirmBody(args: {
  type: IntakeOrderType;
  counterpartyName: string;
  counterpartyId: string | null;
  date: string;
  items: IntakeReviewItem[];
  tax: number;
  autoRegister: boolean;
}): ConfirmRequestBody {
  const total =
    args.items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0) +
    Number(args.tax || 0);
  return {
    type: args.type,
    counterpartyName: args.counterpartyName,
    counterpartyId: args.counterpartyId,
    occurredAt: args.date,
    total,
    tax: Number(args.tax || 0),
    autoRegisterProducts: args.autoRegister,
    items: args.items,
  };
}

export function IntakeReviewForm(props: IntakeReviewFormProps) {
  const router = useRouter();

  const [type, setType] = useState<IntakeOrderType>(deriveInitialType(props.parsed));
  const [date, setDate] = useState<string>(deriveInitialDate(props.parsed));
  const [counterpartyName, setCounterpartyName] = useState<string>(
    props.parsed?.vendor ?? "",
  );
  // WI-713b will wire counterpartyId via the autocomplete; for now it is
  // always null and the API resolves by name.
  const [counterpartyId] = useState<string | null>(null);
  const [items, setItems] = useState<IntakeReviewItem[]>(() =>
    toReviewItems(props.parsed),
  );
  const [tax, setTax] = useState<number>(deriveInitialTax(props.parsed));
  const [autoRegister, setAutoRegister] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const total =
    items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0) + Number(tax || 0);
  const isPending = props.status === "PENDING";
  const confidencePercent = Math.max(
    0,
    Math.min(100, Math.floor((props.parsed?.confidence ?? 0) * 100)),
  );

  async function handleConfirm() {
    if (!isPending || submitting) return;
    if (items.length === 0) {
      setError("등록할 품목이 없습니다. 한 개 이상 추가하세요.");
      return;
    }
    if (!counterpartyName.trim()) {
      setError("거래처를 입력하세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body = buildConfirmBody({
        type,
        counterpartyName: counterpartyName.trim(),
        counterpartyId,
        date,
        items,
        tax,
        autoRegister,
      });
      const res = await fetch(`/api/erp/intake/${props.draftId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 409) {
        throw new Error("이미 등록됨");
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { orderId: string };
      router.push(`/erp/orders/${data.orderId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "등록 실패");
      setSubmitting(false);
    }
  }

  async function handleDiscard() {
    if (!isPending || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/erp/intake/${props.draftId}/discard`, {
        method: "POST",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      router.push("/erp/intake");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "폐기 실패");
      setSubmitting(false);
    }
  }

  const formDisabled = !isPending || submitting;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">영수증 검토</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            OCR로 추출된 정보를 확인하고 주문으로 등록합니다.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          상태: <span className="font-medium text-foreground">{props.status}</span>
          {props.confirmedOrderId ? (
            <>
              {" "}
              ·{" "}
              <a
                href={`/erp/orders/${props.confirmedOrderId}`}
                className="text-blue-600 hover:underline"
              >
                연결된 주문 보기
              </a>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="lg:sticky lg:top-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={props.blobUrl}
              alt="영수증 원본 이미지"
              className="w-full rounded-md border bg-muted object-contain"
            />
          </div>
        </div>

        <div className="space-y-4">
          {props.errorMsg ? (
            <div
              role="alert"
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
            >
              OCR 경고: {props.errorMsg} (수동 입력 가능)
            </div>
          ) : null}

          <div className="text-xs text-muted-foreground">
            OCR 신뢰도{" "}
            <span className="font-medium text-foreground">
              {confidencePercent}%
            </span>
          </div>

          <fieldset className="space-y-1" disabled={formDisabled}>
            <legend className="text-sm font-medium">유형</legend>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="intake-type"
                  checked={type === "SALE"}
                  onChange={() => setType("SALE")}
                />
                판매
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="intake-type"
                  checked={type === "PURCHASE"}
                  onChange={() => setType("PURCHASE")}
                />
                구매
              </label>
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="block font-medium">일자</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={formDisabled}
                className="mt-1 w-full rounded border px-2 py-1 disabled:bg-muted"
              />
            </label>
            <label className="block text-sm">
              <span className="block font-medium">거래처</span>
              <input
                type="text"
                value={counterpartyName}
                onChange={(e) => setCounterpartyName(e.target.value)}
                disabled={formDisabled}
                maxLength={200}
                className="mt-1 w-full rounded border px-2 py-1 disabled:bg-muted"
              />
            </label>
          </div>

          <div className="space-y-1">
            <h2 className="text-sm font-medium">품목</h2>
            <ItemsTable
              items={items}
              setItems={setItems}
              suggestions={props.matchSuggestions?.items ?? []}
              disabled={formDisabled}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="block font-medium">세금 (KRW)</span>
              <input
                type="number"
                min={0}
                step="1"
                value={tax}
                onChange={(e) => setTax(Number(e.target.value) || 0)}
                disabled={formDisabled}
                className="mt-1 w-full rounded border px-2 py-1 text-right tabular-nums disabled:bg-muted"
              />
            </label>
            <div className="block text-sm">
              <span className="block font-medium">총액 (KRW)</span>
              <div className="mt-1 rounded border bg-muted px-2 py-1 text-right text-base font-semibold tabular-nums">
                {CURRENCY_FMT.format(total)}
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRegister}
              onChange={(e) => setAutoRegister(e.target.checked)}
              disabled={formDisabled}
            />
            매칭 안 된 상품을 자동으로 신규 등록
          </label>

          {error ? (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!isPending || submitting}
            >
              {submitting ? "등록 중…" : "등록"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDiscard}
              disabled={!isPending || submitting}
            >
              폐기
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
