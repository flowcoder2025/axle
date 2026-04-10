import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { notFound } from "next/navigation";
import { EstimateForm } from "../../../../src/components/estimates/estimate-form";

export const metadata = {
  title: "견적서 작성 | AXLE",
};

export default async function NewEstimatePage() {
  const user = await getCurrentUser();
  if (!user?.orgId) notFound();

  const clients = await prisma.client.findMany({
    where: { orgId: user.orgId, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">견적서 작성</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          새 견적서를 작성합니다.
        </p>
      </div>

      <EstimateForm clients={clients} />
    </div>
  );
}
