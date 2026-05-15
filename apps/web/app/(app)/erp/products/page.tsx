/**
 * /erp/products — Product list (Server Component).
 *
 * Auth: requires `erp:read` scope. Auth failures throw and surface in the
 * shared `error.tsx`. We intentionally do not catch & redirect here so the
 * user sees the actual error reason instead of an opaque redirect.
 */

import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@axle/db";
import { Button } from "@axle/ui";
import { Plus } from "lucide-react";
import { requireErpScope } from "@/lib/erp/auth";
import { serializeProduct } from "@/lib/erp/serialize";

export const metadata = {
  title: "상품 관리 | AXLE",
};

interface PageProps {
  searchParams: Promise<{ q?: string; includeArchived?: string }>;
}

/** Hard cap on rows surfaced in the product list page. Mirrors the API's
 * `MAX_LIST` so the UI does not silently differ. When `rows.length` equals
 * this value the UI shows a truncation notice asking the user to narrow. */
const PRODUCT_LIST_LIMIT = 200;

export default async function ErpProductsPage({ searchParams }: PageProps) {
  const ctx = await requireErpScope("erp:read");
  const { q: qRaw, includeArchived: archivedRaw } = await searchParams;
  const q = qRaw?.trim() || undefined;
  const includeArchived = archivedRaw === "1";

  const where: Prisma.ProductWhereInput = {
    orgId: ctx.orgId,
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    ...(includeArchived ? {} : { archived: false }),
  };

  const rows = await prisma.product.findMany({
    where,
    orderBy: { name: "asc" },
    take: PRODUCT_LIST_LIMIT,
  });
  const products = rows.map(serializeProduct);
  const truncated = rows.length === PRODUCT_LIST_LIMIT;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">상품 관리</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ERP에서 다루는 상품 목록입니다. 영수증 인테이크와 주문에서 사용합니다.
          </p>
        </div>
        <Link href="/erp/products/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />신규 상품
          </Button>
        </Link>
      </div>

      <form className="flex items-center gap-2" action="/erp/products" method="get">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="이름으로 검색"
          className="h-9 w-64 rounded-md border bg-background px-3 text-sm"
        />
        <label className="flex items-center gap-1 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="includeArchived"
            value="1"
            defaultChecked={includeArchived}
          />
          보관됨 포함
        </label>
        <Button type="submit" variant="outline" size="sm">검색</Button>
      </form>

      {truncated ? (
        <p className="text-xs text-muted-foreground">
          최대 {PRODUCT_LIST_LIMIT}개까지 표시됩니다. 검색으로 좁혀주세요.
        </p>
      ) : null}

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">이름</th>
              <th className="px-3 py-2 text-right">단가 (KRW)</th>
              <th className="px-3 py-2">단위</th>
              <th className="px-3 py-2">카테고리</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2 text-right">액션</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  등록된 상품이 없습니다. 우측 상단의 &quot;신규 상품&quot; 버튼으로 추가하세요.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{p.sku ?? "-"}</td>
                  <td className="px-3 py-2">
                    <Link className="font-medium hover:underline" href={`/erp/products/${p.id}`}>
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.unitPrice}</td>
                  <td className="px-3 py-2">{p.unit}</td>
                  <td className="px-3 py-2">{p.category ?? "-"}</td>
                  <td className="px-3 py-2">
                    {p.archived ? (
                      <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">보관됨</span>
                    ) : (
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">활성</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      className="text-xs text-muted-foreground hover:underline"
                      href={`/erp/products/${p.id}/edit`}
                    >
                      편집
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
