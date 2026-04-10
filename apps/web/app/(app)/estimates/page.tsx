import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@axle/ui";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { Prisma } from "@prisma/client";
import { EstimateTable } from "../../../src/components/estimates/estimate-table";
import { ContractTable } from "../../../src/components/contracts/contract-table";

export const metadata = {
  title: "견적/계약 | AXLE",
};

interface SearchParams {
  tab?: string;
  status?: string;
  page?: string;
  pageSize?: string;
}

interface EstimatesPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function EstimatesPage({ searchParams }: EstimatesPageProps) {
  const user = await getCurrentUser();
  if (!user?.orgId) notFound();

  const params = await searchParams;
  const tab = params.tab === "contracts" ? "contracts" : "estimates";
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize ?? "20") || 20));
  const skip = (page - 1) * pageSize;
  const status = params.status;

  const orgFilter = { client: { orgId: user.orgId } };

  if (tab === "contracts") {
    const contractWhere: Prisma.ContractWhereInput = {
      ...orgFilter,
      ...(status ? { status: status as Prisma.EnumContractStatusFilter } : {}),
    };

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where: contractWhere,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          contractNumber: true,
          clientId: true,
          projectId: true,
          title: true,
          totalAmount: true,
          status: true,
          startDate: true,
          endDate: true,
          signedAt: true,
          createdAt: true,
          client: { select: { name: true } },
        },
      }),
      prisma.contract.count({ where: contractWhere }),
    ]);

    const serializedContracts = contracts.map((c) => ({
      ...c,
      totalAmount: c.totalAmount ? c.totalAmount.toString() : null,
      startDate: c.startDate?.toISOString() ?? null,
      endDate: c.endDate?.toISOString() ?? null,
      signedAt: c.signedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    }));

    return (
      <div className="space-y-6">
        <PageHeader tab={tab} />
        <Suspense>
          <ContractTable
            contracts={serializedContracts}
            total={total}
            page={page}
            pageSize={pageSize}
            currentStatus={status}
          />
        </Suspense>
      </div>
    );
  }

  // Estimates tab
  const estimateWhere: Prisma.EstimateWhereInput = {
    ...orgFilter,
    ...(status ? { status: status as Prisma.EnumEstimateStatusFilter } : {}),
  };

  const [estimates, total] = await Promise.all([
    prisma.estimate.findMany({
      where: estimateWhere,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        estimateNumber: true,
        clientId: true,
        projectId: true,
        totalAmount: true,
        taxAmount: true,
        status: true,
        validUntil: true,
        sentAt: true,
        createdAt: true,
        client: { select: { name: true } },
      },
    }),
    prisma.estimate.count({ where: estimateWhere }),
  ]);

  const serializedEstimates = estimates.map((e) => ({
    ...e,
    totalAmount: e.totalAmount.toString(),
    taxAmount: e.taxAmount ? e.taxAmount.toString() : null,
    validUntil: e.validUntil?.toISOString() ?? null,
    sentAt: e.sentAt?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader tab={tab} />
      <Suspense>
        <EstimateTable
          estimates={serializedEstimates}
          total={total}
          page={page}
          pageSize={pageSize}
          currentStatus={status}
        />
      </Suspense>
    </div>
  );
}

function PageHeader({ tab }: { tab: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">견적/계약</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          견적서와 계약서를 생성하고 관리합니다.
        </p>
      </div>
      <div className="flex items-center gap-3">
        {/* Tab navigation */}
        <div className="flex rounded-lg border overflow-hidden">
          <Link
            href="/estimates?tab=estimates"
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === "estimates"
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted"
            }`}
          >
            견적서
          </Link>
          <Link
            href="/estimates?tab=contracts"
            className={`px-4 py-2 text-sm font-medium border-l transition-colors ${
              tab === "contracts"
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted"
            }`}
          >
            계약서
          </Link>
        </div>
        {tab === "estimates" && (
          <Button asChild>
            <Link href="/estimates/new">
              <Plus className="mr-2 h-4 w-4" />
              견적서 작성
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
