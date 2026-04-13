import { notFound } from "next/navigation";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { EstimateForm } from "../../../../../src/components/estimates/estimate-form";

export const metadata = {
  title: "견적서 수정 | AXLE",
};

interface PageProps {
  params: Promise<{ estimateId: string }>;
}

export default async function EditEstimatePage({ params }: PageProps) {
  const user = await getCurrentUser();
  const { estimateId } = await params;

  if (!user?.orgId) notFound();

  const estimate = await prisma.estimate.findFirst({
    where: { id: estimateId, client: { orgId: user.orgId } },
    select: {
      id: true,
      estimateNumber: true,
      clientId: true,
      items: true,
      totalAmount: true,
      taxAmount: true,
      validUntil: true,
      status: true,
    },
  });

  if (!estimate) notFound();
  if (estimate.status !== "DRAFT" && estimate.status !== "SENT") notFound();

  const clients = await prisma.client.findMany({
    where: { orgId: user.orgId, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const items = Array.isArray(estimate.items)
    ? (estimate.items as Array<{
        name: string;
        quantity: number;
        unitPrice: number;
        amount: number;
      }>)
    : [];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">견적서 수정</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-medium">{estimate.estimateNumber}</span>을 수정합니다.
        </p>
      </div>

      <EstimateForm
        clients={clients}
        mode="edit"
        estimateId={estimate.id}
        initialData={{
          clientId: estimate.clientId,
          validUntil: estimate.validUntil
            ? estimate.validUntil.toISOString().slice(0, 10)
            : "",
          items,
        }}
      />
    </div>
  );
}
