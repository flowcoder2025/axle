import { notFound } from "next/navigation";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { ClientForm } from "../../../../../src/components/clients/client-form";

export const metadata = {
  title: "고객사 수정 | AXLE",
};

interface PageProps {
  params: Promise<{ clientId: string }>;
}

export default async function EditClientPage({ params }: PageProps) {
  const user = await getCurrentUser();
  const { clientId } = await params;

  if (!user?.orgId) {
    notFound();
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, orgId: user.orgId },
    select: {
      id: true,
      name: true,
      businessNumber: true,
      ceoName: true,
      industry: true,
      address: true,
      phone: true,
      email: true,
      website: true,
      memo: true,
      status: true,
      assignedToId: true,
      region: true,
      employeeCount: true,
      capitalAmount: true,
      foundedDate: true,
      isVenture: true,
      isInnoBiz: true,
      isMainBiz: true,
      isSocial: true,
      ventureValidUntil: true,
    },
  });

  if (!client) {
    notFound();
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">고객사 수정</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-medium">{client.name}</span>의 정보를 수정합니다.
        </p>
      </div>

      <ClientForm
        mode="edit"
        clientId={client.id}
        initialData={{
          name: client.name,
          businessNumber: client.businessNumber ?? "",
          ceoName: client.ceoName ?? "",
          industry: client.industry ?? "",
          address: client.address ?? "",
          phone: client.phone ?? "",
          email: client.email ?? "",
          website: client.website ?? "",
          memo: client.memo ?? "",
          status: (client.status as "ACTIVE" | "INACTIVE" | "PROSPECT") ?? "ACTIVE",
          assignedToId: client.assignedToId ?? "",
          region: client.region ?? "",
          employeeCount: client.employeeCount ?? undefined,
          capitalAmount: client.capitalAmount != null ? Number(client.capitalAmount) : undefined,
          foundedDate: client.foundedDate ? client.foundedDate.toISOString().slice(0, 10) : "",
          isVenture: client.isVenture,
          isInnoBiz: client.isInnoBiz,
          isMainBiz: client.isMainBiz,
          isSocial: client.isSocial,
          ventureValidUntil: client.ventureValidUntil
            ? client.ventureValidUntil.toISOString().slice(0, 10)
            : "",
        }}
      />
    </div>
  );
}
