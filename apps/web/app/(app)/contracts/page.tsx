import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Prisma } from "@prisma/client";
import { ContractTable } from "../../../src/components/contracts/contract-table";

export const metadata = {
  title: "계약서 | AXLE",
};

interface SearchParams {
  status?: string;
  page?: string;
  pageSize?: string;
}

interface ContractsPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function ContractsPage({ searchParams }: ContractsPageProps) {
  const user = await getCurrentUser();
  if (!user?.orgId) notFound();

  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize ?? "20") || 20));
  const skip = (page - 1) * pageSize;
  const status = params.status;

  const where: Prisma.ContractWhereInput = {
    client: { orgId: user.orgId },
    ...(status ? { status: status as Prisma.EnumContractStatusFilter } : {}),
  };

  const [contracts, total] = await Promise.all([
    prisma.contract.findMany({
      where,
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
    prisma.contract.count({ where }),
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">계약서</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          계약서를 조회하고 관리합니다.
        </p>
      </div>

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
