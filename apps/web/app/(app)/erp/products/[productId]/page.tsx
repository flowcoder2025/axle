/**
 * /erp/products/[productId] — Product detail (Server Component).
 *
 * Shows the canonical product fields plus a recent-movements summary that
 * links to /erp/inventory (delivered in WI-707). We avoid pre-loading the
 * full movement history here — the inventory page owns that view.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@axle/db";
import { Button } from "@axle/ui";
import { requireErpScope } from "@/lib/erp/auth";
import { serializeProduct } from "@/lib/erp/serialize";

export const metadata = {
  title: "상품 상세 | AXLE",
};

interface PageProps {
  params: Promise<{ productId: string }>;
}

export default async function ProductDetailPage({ params }: PageProps) {
  const ctx = await requireErpScope("erp:read");
  const { productId } = await params;

  const row = await prisma.product.findFirst({
    where: { id: productId, orgId: ctx.orgId },
  });
  if (!row) notFound();
  const product = serializeProduct(row);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            SKU: <span className="font-mono">{product.sku ?? "-"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/erp/products/${product.id}/edit`}>
            <Button variant="outline">편집</Button>
          </Link>
          <Link href={`/erp/inventory?productId=${product.id}`}>
            <Button variant="outline">재고 이력</Button>
          </Link>
        </div>
      </div>

      <div className="rounded-md border p-4">
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">단위</dt>
            <dd className="mt-0.5 font-medium">{product.unit}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">단가 (KRW)</dt>
            <dd className="mt-0.5 font-medium tabular-nums">{product.unitPrice}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">카테고리</dt>
            <dd className="mt-0.5 font-medium">{product.category ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">상태</dt>
            <dd className="mt-0.5 font-medium">
              {product.archived ? "보관됨" : "활성"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">생성일</dt>
            <dd className="mt-0.5 font-medium">{product.createdAt ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">수정일</dt>
            <dd className="mt-0.5 font-medium">{product.updatedAt ?? "-"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
