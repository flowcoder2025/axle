"use client";

/**
 * CounterpartyAutocomplete — Searchable combobox for the receipt review
 * vendor / customer field.
 *
 * Phase 20 WI-713b. Mirrors product-autocomplete: seed from
 * `matchSuggestions.counterparty.candidates` (fuzzy-match top-3 from upload),
 * live search via `/api/clients?q=` with 200ms debounce, "+ 신규 거래처"
 * fallback at the end.
 *
 * Selection contract:
 *   - Existing client picked → onChange({counterpartyId: id, counterpartyName})
 *   - "+ 신규 거래처 'q'" picked → onChange({counterpartyId: null, counterpartyName: q})
 *     The confirm endpoint resolves by name in that case and may upsert.
 *
 * onMouseDown vs onClick: same rationale as ProductAutocomplete — blur fires
 * before click, so onMouseDown on the option preempts the dropdown collapse.
 */

import { useEffect, useMemo, useRef, useState } from "react";

export interface CounterpartySuggestion {
  id: string;
  name: string;
}

export interface CounterpartySelection {
  counterpartyId: string | null;
  counterpartyName: string;
}

export interface CounterpartySeedCandidate {
  item: CounterpartySuggestion;
  score: number;
  needsNew: boolean;
}

interface CounterpartyAutocompleteProps {
  value: string;
  initialSuggestions?: CounterpartySeedCandidate[];
  onChange: (v: CounterpartySelection) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

const DEBOUNCE_MS = 200;
const MAX_VISIBLE = 8;
const CLIENT_PAGE_SIZE = 8;

interface ClientListResponse {
  data?: Array<{ id: string; name: string }>;
}

export function CounterpartyAutocomplete({
  value,
  initialSuggestions = [],
  onChange,
  disabled = false,
  ariaLabel,
}: CounterpartyAutocompleteProps) {
  const [query, setQuery] = useState<string>(value);
  const [open, setOpen] = useState<boolean>(false);
  const [results, setResults] = useState<CounterpartySuggestion[]>([]);
  const [searched, setSearched] = useState<boolean>(false);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const seedItems = useMemo<CounterpartySuggestion[]>(
    () => initialSuggestions.map((c) => c.item).slice(0, MAX_VISIBLE),
    [initialSuggestions],
  );

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
          `/api/clients?q=${encodeURIComponent(trimmed)}&page=1&pageSize=${CLIENT_PAGE_SIZE}`,
          { credentials: "same-origin" },
        );
        if (!res.ok) {
          if (reqIdRef.current === myReqId) {
            setResults([]);
            setSearched(true);
          }
          return;
        }
        const data = (await res.json()) as ClientListResponse;
        const list = Array.isArray(data.data)
          ? data.data
              .map((c) => ({ id: c.id, name: c.name }))
              .slice(0, MAX_VISIBLE)
          : [];
        if (reqIdRef.current === myReqId) {
          setResults(list);
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

  const visible: CounterpartySuggestion[] =
    query.trim().length > 0 && searched ? results : seedItems;

  function selectExisting(c: CounterpartySuggestion) {
    setQuery(c.name);
    setOpen(false);
    onChange({ counterpartyId: c.id, counterpartyName: c.name });
  }

  function selectNew(name: string) {
    const trimmed = name.trim();
    setQuery(trimmed);
    setOpen(false);
    onChange({ counterpartyId: null, counterpartyName: trimmed });
  }

  function handleInputChange(next: string) {
    setQuery(next);
    setOpen(true);
    // Live editing clears the id reference; user must pick from the list
    // (or accept the "+ 신규" fallback) to set it again.
    onChange({ counterpartyId: null, counterpartyName: next });
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
        aria-label={ariaLabel ?? "거래처 검색"}
        autoComplete="off"
        maxLength={200}
        className="mt-1 w-full rounded border px-2 py-1 text-sm disabled:bg-muted disabled:text-muted-foreground"
      />
      {open && !disabled && (visible.length > 0 || showNewOption) ? (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-md border bg-white shadow-md"
        >
          {visible.map((c) => (
            <li
              key={c.id}
              role="option"
              aria-selected={false}
              onMouseDown={(e) => {
                e.preventDefault();
                selectExisting(c);
              }}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-muted/60"
            >
              <span className="truncate">{c.name}</span>
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
              + 신규 거래처 &quot;{query.trim()}&quot;
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
