import { notFound } from "next/navigation";
import { prisma } from "@axle/db";
import { requireErpScope } from "@/lib/erp/auth";
import { serializeProduct } from "@/lib/erp/serialize";
import { ProductForm } from "../../product-form";

export const metadata = {
  title: "상품 편집 | AXLE",
};

interface PageProps {
  params: Promise<{ productId: string }>;
}

export default async function EditProductPage({ params }: PageProps) {
  const ctx = await requireErpScope("erp:write");
  const { productId } = await params;

  const row = await prisma.product.findFirst({
    where: { id: productId, orgId: ctx.orgId },
  });
  if (!row) notFound();
  const product = serializeProduct(row);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">상품 편집</h1>
        <p className="mt-1 text-sm text-muted-foreground">{product.name}</p>
      </div>
      <ProductForm
        mode="edit"
        productId={product.id}
        initial={{
          sku: product.sku,
          name: product.name,
          unit: product.unit,
          unitPrice: product.unitPrice,
          category: product.category,
        }}
      />
    </div>
  );
}
