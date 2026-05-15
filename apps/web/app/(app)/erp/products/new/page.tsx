import { requireErpScope } from "@/lib/erp/auth";
import { ProductForm } from "../product-form";

export const metadata = {
  title: "상품 추가 | AXLE",
};

export default async function NewProductPage() {
  // Auth gate. Throws on missing scope (handled by route segment error boundary).
  await requireErpScope("erp:write");

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">상품 추가</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          새로운 상품을 등록합니다.
        </p>
      </div>
      <ProductForm mode="create" />
    </div>
  );
}
