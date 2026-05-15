/**
 * /erp/inventory — Inventory timeline + current stock (Server Component).
 *
 * Two-pane layout:
 *   - Left: product picker (links scoped to the active tenant).
 *   - Right: stock summary cards + movement timeline, with period/type
 *     filters applied via URL params. Filtering is a plain GET form so we
 *     can keep the page a Server Component (no client state required).
 *
 * Auth: `erp:read`. We delegate to {@link fetchInventoryView} (same module
 * the `/api/erp/inventory` route uses) so the page and the API never drift
 * on filter semantics, take limit, or balance computation.
 */

import Link from "next/link";
import { MovementType } from "@prisma/client";
import { prisma } from "@axle/db";
import { requireErpScope, ErpNotFoundError } from "@/lib/erp/auth";
import {
  fetchInventoryView,
  INVENTORY_MOVEMENT_LIMIT,
  parseInventoryDateParam,
} from "@/lib/erp/inventory";
import { StockSummary } from "@/src/components/erp/inventory/stock-summary";
import { MovementTimeline } from "@/src/components/erp/inventory/movement-timeline";

export const metadata = {
  title: "재고 흐름 | AXLE",
};

interface PageProps {
  searchParams: Promise<{
    productId?: string;
    from?: string;
    to?: string;
    type?: string;
  }>;
}

const VALID_TYPES = new Set<string>(["IN", "OUT", "ADJUST"]);
const PRODUCT_LIST_LIMIT = 200;

export default async function ErpInventoryPage({ searchParams }: PageProps) {
  const ctx = await requireErpScope("erp:read");
  const params = await searchParams;
  const selectedProductId = params.productId?.trim() || undefined;
  const fromRaw = params.from?.trim() || "";
  const toRaw = params.to?.trim() || "";
  const typeRaw = params.type?.trim() || "";
  const typeFilter =
    typeRaw && VALID_TYPES.has(typeRaw) ? (typeRaw as MovementType) : undefined;

  // Left pane: products to pick from. Capped like /erp/products.
  const products = await prisma.product.findMany({
    where: { orgId: ctx.orgId, archived: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true, unit: true, sku: true },
    take: PRODUCT_LIST_LIMIT,
  });

  // If a product is selected, validate ownership and fetch its detail.
  const selectedProduct = selectedProductId
    ? await prisma.product.findFirst({
        where: { id: selectedProductId, orgId: ctx.orgId },
        select: { id: true, name: true, unit: true, sku: true, category: true },
      })
    : null;

  let movements: Awaited<ReturnType<typeof fetchInventoryView>>["movements"] = [];
  let stock = { in: 0, out: 0, adjust: 0, balance: 0 };
  let truncated = false;

  if (selectedProduct) {
    const from = parseInventoryDateParam(fromRaw, "start");
    const to = parseInventoryDateParam(toRaw, "end");
    try {
      const view = await fetchInventoryView(ctx.orgId, {
        productId: selectedProduct.id,
        from,
        to,
        type: typeFilter,
      });
      movements = view.movements;
      stock = view.stock;
      truncated = view.truncated;
    } catch (err) {
      // We already verified ownership above, so a NotFound here would be a
      // race (product archived/deleted between queries). Treat as empty so
      // the user sees the picker rather than a crash.
      if (!(err instanceof ErpNotFoundError)) throw err;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">재고 흐름</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          상품별 입출고 타임라인과 현재 재고를 확인합니다. 기간과 유형으로 필터링할 수 있습니다.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        {/* Left: product picker */}
        <aside className="rounded-md border">
          <div className="border-b bg-muted/40 px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
            상품 선택
          </div>
          {products.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              등록된 상품이 없습니다.{" "}
              <Link className="underline" href="/erp/products">
                상품 관리
              </Link>
              에서 추가하세요.
            </div>
          ) : (
            <ul className="max-h-[60vh] divide-y overflow-y-auto">
              {products.map((p) => {
                const active = p.id === selectedProductId;
                return (
                  <li key={p.id}>
                    <Link
                      href={`/erp/inventory?productId=${encodeURIComponent(p.id)}`}
                      className={`block px-3 py-2 text-sm hover:bg-muted/50 ${
                        active ? "bg-muted font-medium" : ""
                      }`}
                    >
                      <div className="truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.sku ? `SKU ${p.sku}` : "SKU 없음"} · {p.unit}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Right: summary + filters + timeline */}
        <section className="space-y-4">
          {!selectedProduct ? (
            <div className="rounded-md border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              왼쪽 목록에서 상품을 선택하세요.
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-semibold">{selectedProduct.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {selectedProduct.sku ? `SKU ${selectedProduct.sku}` : "SKU 없음"}
                  {selectedProduct.category ? ` · ${selectedProduct.category}` : ""}
                </p>
              </div>

              <StockSummary
                balance={stock.balance}
                inSum={stock.in}
                outSum={stock.out}
                adjustSum={stock.adjust}
                unit={selectedProduct.unit}
              />

              <form
                action="/erp/inventory"
                method="get"
                className="flex flex-wrap items-end gap-3 rounded-md border bg-card p-3"
              >
                <input type="hidden" name="productId" value={selectedProduct.id} />
                <label className="flex flex-col text-xs text-muted-foreground">
                  시작일
                  <input
                    type="date"
                    name="from"
                    defaultValue={fromRaw}
                    className="mt-1 h-9 rounded-md border bg-background px-2 text-sm"
                  />
                </label>
                <label className="flex flex-col text-xs text-muted-foreground">
                  종료일
                  <input
                    type="date"
                    name="to"
                    defaultValue={toRaw}
                    className="mt-1 h-9 rounded-md border bg-background px-2 text-sm"
                  />
                </label>
                <label className="flex flex-col text-xs text-muted-foreground">
                  유형
                  <select
                    name="type"
                    defaultValue={typeRaw}
                    className="mt-1 h-9 rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="">전체</option>
                    <option value="IN">입고</option>
                    <option value="OUT">출고</option>
                    <option value="ADJUST">조정</option>
                  </select>
                </label>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="h-9 rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted"
                  >
                    필터 적용
                  </button>
                  <Link
                    href={`/erp/inventory?productId=${encodeURIComponent(
                      selectedProduct.id,
                    )}`}
                    className="inline-flex h-9 items-center rounded-md border bg-background px-3 text-sm text-muted-foreground hover:bg-muted"
                  >
                    초기화
                  </Link>
                </div>
              </form>

              <MovementTimeline movements={movements} unit={selectedProduct.unit} />
              {truncated ? (
                <p className="text-xs text-muted-foreground">
                  최근 {INVENTORY_MOVEMENT_LIMIT}건만 표시합니다. 기간을 좁히면 이전 기록을 확인할 수 있습니다.
                </p>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
