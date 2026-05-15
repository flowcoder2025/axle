"use client";

/**
 * ProductAutocomplete — Searchable combobox for the receipt review item rows.
 *
 * Phase 20 WI-713b: replaces the bare productName input in items-table. Seed
 * suggestions come from `matchSuggestions.items[i].candidates` (fuzzy-match
 * top-3 from intake upload) so users see plausible product matches without
 * typing. Live search hits `/api/erp/products?q=` with a 200ms debounce.
 *
 * Selection contract:
 *   - Existing product picked → onChange({productId, productName, sku, unit, unitPrice})
 *   - "+ 신규 상품 'q'" picked → onChange({productId: null, productName: q,
 *     sku: null, unit: "개", unitPrice: 0}). The row's shouldRegister toggle
 *     decides whether the confirm endpoint actually creates a Product row.
 *
 * Why onMouseDown instead of onClick:
 *   Input blur fires before click — onClick on the dropdown item would lose
 *   the race with onBlur closing the panel. onMouseDown wins because mouse
 *   button down triggers it before focus leaves the input.
 */

import { useEffect, useMemo, useRef, useState } from "react";

export interface ProductSuggestion {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  /** Decimal serialized as string from the API. */
  unitPrice: string;
}

export interface ProductSelection {
  productId: string | null;
  productName: string;
  sku: string | null;
  unit: string;
  unitPrice: number;
}

/** Shape of one entry in `matchSuggestions.items[i].candidates`. */
export interface ProductSeedCandidate {
  item: ProductSuggestion;
  score: number;
  needsNew: boolean;
}

interface ProductAutocompleteProps {
  value: string;
  initialSuggestions?: ProductSeedCandidate[];
  onChange: (v: ProductSelection) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

const DEBOUNCE_MS = 200;
const MAX_VISIBLE = 8;

function parseUnitPrice(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function ProductAutocomplete({
  value,
  initialSuggestions = [],
  onChange,
  disabled = false,
  ariaLabel,
}: ProductAutocompleteProps) {
  const [query, setQuery] = useState<string>(value);
  const [open, setOpen] = useState<boolean>(false);
  const [results, setResults] = useState<ProductSuggestion[]>([]);
  const [searched, setSearched] = useState<boolean>(false);

  // Keep local query in sync if the parent resets the row (e.g. on row delete).
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Stable seed items (top of dropdown before user types).
  const seedItems = useMemo<ProductSuggestion[]>(
    () => initialSuggestions.map((c) => c.item).slice(0, MAX_VISIBLE),
    [initialSuggestions],
  );

  // Debounced live search against /api/erp/products?q=.
  const reqIdRef = useRef(0);
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResults([]);
      setSearched(false);
      return;
    }
    const timer = setTimeout(async () => {
      const myReqId = ++reqIdRef.current;
      try {
        const res = await fetch(
          `/api/erp/products?q=${encodeURIComponent(trimmed)}`,
          { credentials: "same-origin" },
        );
        if (!res.ok) {
          if (reqIdRef.current === myReqId) {
            setResults([]);
            setSearched(true);
          }
          return;
        }
        const data = (await res.json()) as { items?: ProductSuggestion[] };
        if (reqIdRef.current === myReqId) {
          setResults(
            Array.isArray(data.items) ? data.items.slice(0, MAX_VISIBLE) : [],
          );
          setSearched(true);
        }
      } catch {
        if (reqIdRef.current === myReqId) {
          setResults([]);
          setSearched(true);
        }
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Dropdown list: live results when the user has typed, otherwise seeds.
  const visible: ProductSuggestion[] =
    query.trim().length > 0 && searched ? results : seedItems;

  function selectExisting(p: ProductSuggestion) {
    setQuery(p.name);
    setOpen(false);
    onChange({
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      unit: p.unit,
      unitPrice: parseUnitPrice(p.unitPrice),
    });
  }

  function selectNew(name: string) {
    const trimmed = name.trim();
    setQuery(trimmed);
    setOpen(false);
    onChange({
      productId: null,
      productName: trimmed,
      sku: null,
      unit: "개",
      unitPrice: 0,
    });
  }

  function handleInputChange(next: string) {
    setQuery(next);
    setOpen(true);
    // As the user types, the row's productName follows the query but the
    // product reference is cleared until they pick something (or accept the
    // ad-hoc fallback).
    onChange({
      productId: null,
      productName: next,
      sku: null,
      unit: "개",
      unitPrice: 0,
    });
  }

  const showNewOption = query.trim().length > 0;

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        disabled={disabled}
        aria-label={ariaLabel ?? "상품 검색"}
        autoComplete="off"
        className="w-full rounded border px-2 py-1 text-sm disabled:bg-muted disabled:text-muted-foreground"
      />
      {open && !disabled && (visible.length > 0 || showNewOption) ? (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-md border bg-white shadow-md"
        >
          {visible.map((p) => (
            <li
              key={p.id}
              role="option"
              aria-selected={false}
              onMouseDown={(e) => {
                e.preventDefault();
                selectExisting(p);
              }}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-muted/60"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {p.sku ? `${p.sku} · ` : ""}
                  {p.unit}
                </span>
              </div>
            </li>
          ))}
          {showNewOption ? (
            <li
              role="option"
              aria-selected={false}
              onMouseDown={(e) => {
                e.preventDefault();
                selectNew(query);
              }}
              className="cursor-pointer border-t px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
            >
              + 신규 상품 &quot;{query.trim()}&quot;
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
