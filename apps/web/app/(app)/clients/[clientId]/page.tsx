import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { Button } from "@axle/ui";
import { ArrowLeft, Pencil } from "lucide-react";
import { ClientStatusBadge } from "../../../../src/components/clients/client-status-badge";
import { ClientDetailTabs } from "../../../../src/components/clients/client-detail-tabs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const client = await prisma.client.findFirst({
    where: { id: clientId },
    select: { name: true },
  });
  return { title: client ? `${client.name} | AXLE` : "고객사 상세 | AXLE" };
}

interface PageProps {
  params: Promise<{ clientId: string }>;
}

export default async function ClientDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  const { clientId } = await params;

  if (!user?.orgId) {
    notFound();
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, orgId: user.orgId },
    include: {
      _count: { select: { contacts: true, projects: true } },
    },
  });

  if (!client) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb / back */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          고객사 목록
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{client.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
            <ClientStatusBadge status={client.status as "ACTIVE" | "INACTIVE" | "PROSPECT"} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {client.ceoName && <span>대표: {client.ceoName}</span>}
            {client.industry && <span>업종: {client.industry}</span>}
            {client.region && <span>지역: {client.region}</span>}
            <span>인물 {client._count.contacts}명</span>
            <span>프로젝트 {client._count.projects}건</span>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/clients/${clientId}/edit`}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            편집
          </Link>
        </Button>
      </div>

      {/* Tabs — client component handles active tab state */}
      <ClientDetailTabs
        clientId={clientId}
        client={{
          id: client.id,
          name: client.name,
          businessNumber: client.businessNumber,
          ceoName: client.ceoName,
          industry: client.industry,
          address: client.address,
          phone: client.phone,
          email: client.email,
          website: client.website,
          memo: client.memo,
          region: client.region,
          isVenture: client.isVenture,
          isInnoBiz: client.isInnoBiz,
          isMainBiz: client.isMainBiz,
          isSocial: client.isSocial,
        }}
      />
    </div>
  );
}
