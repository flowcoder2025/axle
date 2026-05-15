"use client";

/**
 * Shared client-side form for /erp/products/new and /erp/products/[id]/edit.
 *
 * Talks to the REST API rather than a Server Action so the same form serves
 * both create (POST /api/erp/products) and update (PATCH /api/erp/products/[id]).
 */

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Input, Label } from "@axle/ui";

export interface ProductFormValues {
  sku: string | null;
  name: string;
  unit: string;
  unitPrice: string;
  category: string | null;
}

interface ProductFormProps {
  mode: "create" | "edit";
  productId?: string;
  initial?: Partial<ProductFormValues>;
}

/**
 * Pull a human-readable message out of an error `Response`. Tries to parse
 * the canonical AXLE envelope `{ error: { code, message } }` first; falls
 * back to raw text so callers still get *something* if the body is plain.
 */
async function extractErrorMessage(res: Response): Promise<string> {
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      const body = (await res.json()) as
        | { error?: { code?: string; message?: string } }
        | undefined;
      const msg = body?.error?.message;
      if (typeof msg === "string" && msg.trim().length > 0) {
        return msg;
      }
    } catch {
      // fall through to text
    }
    return "";
  }
  try {
    return await res.text();
  } catch {
    return "";
  }
}

const EMPTY: ProductFormValues = {
  sku: "",
  name: "",
  unit: "",
  unitPrice: "0",
  category: "",
};

export function ProductForm({ mode, productId, initial }: ProductFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<ProductFormValues>({
    ...EMPTY,
    ...initial,
    sku: initial?.sku ?? "",
    category: initial?.category ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof ProductFormValues>(key: K, val: ProductFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        sku: values.sku?.trim() || null,
        name: values.name.trim(),
        unit: values.unit.trim(),
        unitPrice: Number(values.unitPrice || "0"),
        category: values.category?.trim() || null,
      };

      const url =
        mode === "create" ? "/api/erp/products" : `/api/erp/products/${productId}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        // The API uses the canonical AXLE envelope
        // `{ error: { code, message } }`. We try JSON first and only fall
        // back to plain text if the body is not JSON — keeps the user-facing
        // message readable instead of dumping the raw stringified envelope.
        const message = await extractErrorMessage(res);
        throw new Error(message || `HTTP ${res.status}`);
      }
      const saved = (await res.json()) as { id: string };
      router.push(`/erp/products/${saved.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">이름 *</Label>
          <Input
            id="name"
            required
            maxLength={200}
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="sku">SKU</Label>
          <Input
            id="sku"
            maxLength={100}
            value={values.sku ?? ""}
            onChange={(e) => update("sku", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="unit">단위 *</Label>
          <Input
            id="unit"
            required
            maxLength={20}
            placeholder="개, 박스, kg"
            value={values.unit}
            onChange={(e) => update("unit", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="unitPrice">단가 (KRW)</Label>
          <Input
            id="unitPrice"
            type="number"
            min={0}
            step="1"
            value={values.unitPrice}
            onChange={(e) => update("unitPrice", e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="category">카테고리</Label>
          <Input
            id="category"
            maxLength={100}
            value={values.category ?? ""}
            onChange={(e) => update("category", e.target.value)}
          />
        </div>
      </div>

      {error ? (
        <p id="product-form-error" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "저장 중…" : mode === "create" ? "등록" : "저장"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={submitting}
        >
          취소
        </Button>
      </div>
    </form>
  );
}
