import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { Button } from "@axle/ui";
import { ClientTable } from "../../../src/components/clients/client-table";
import { ClientKanban } from "../../../src/components/clients/client-kanban";
import { ClientViewToggle } from "../../../src/components/clients/client-view-toggle";
import { Plus, Users } from "lucide-react";
import { Suspense } from "react";
import { Prisma } from "@prisma/client";

export const metadata = {
  title: "고객사 관리 | AXLE",
};

type SortBy = "name" | "createdAt" | "updatedAt" | "status";
type SortOrder = "asc" | "desc";

const VALID_SORT_BY = ["name", "createdAt", "updatedAt", "status"] as const;
const VALID_SORT_ORDER = ["asc", "desc"] as const;

interface SearchParams {
  q?: string;
  status?: string;
  page?: string;
  pageSize?: string;
  sortBy?: string;
  sortOrder?: string;
  view?: string;
}

interface ClientsPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const user = await getCurrentUser();
  if (!user?.orgId) notFound();

  const params = await searchParams;

  const viewMode = params.view === "kanban" ? "kanban" : "table";
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize ?? "20") || 20));
  const skip = (page - 1) * pageSize;
  const sortBy: SortBy = VALID_SORT_BY.includes(params.sortBy as SortBy)
    ? (params.sortBy as SortBy)
    : "createdAt";
  const sortOrder: SortOrder = VALID_SORT_ORDER.includes(params.sortOrder as SortOrder)
    ? (params.sortOrder as SortOrder)
    : "desc";
  const q = params.q?.trim();
  const status = ["ACTIVE", "INACTIVE", "PROSPECT"].includes(params.status ?? "")
    ? (params.status as "ACTIVE" | "INACTIVE" | "PROSPECT")
    : undefined;

  const where: Prisma.ClientWhereInput = {
    orgId: user.orgId,
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { businessNumber: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        name: true,
        ceoName: true,
        status: true,
        assignedToId: true,
        assignedToUser: { select: { id: true, name: true, email: true } },
        updatedAt: true,
        industry: true,
        region: true,
      },
    }),
    prisma.client.count({ where }),
  ]);

  // Serialize dates for client component
  const serializedClients = clients.map((c) => ({
    ...c,
    assignedToUser: c.assignedToUser ?? undefined,
    status: c.status as "ACTIVE" | "INACTIVE" | "PROSPECT",
    updatedAt: c.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">고객사 관리</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            등록된 고객사를 조회하고 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Suspense>
            <ClientViewToggle currentView={viewMode} />
          </Suspense>
          <Button asChild>
            <Link href="/clients/new">
              <Plus className="mr-2 h-4 w-4" />
              고객사 추가
            </Link>
          </Button>
        </div>
      </div>

      {total === 0 && !q && !status ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4 text-center">
          <Users className="h-12 w-12 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-lg font-medium">아직 고객사가 없습니다</p>
            <p className="text-sm text-muted-foreground">
              첫 번째 고객사를 등록하고 관리를 시작하세요.
            </p>
          </div>
          <Button asChild>
            <Link href="/clients/new">
              <Plus className="mr-2 h-4 w-4" />
              고객사 추가
            </Link>
          </Button>
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="py-8 text-center text-muted-foreground">
              불러오는 중...
            </div>
          }
        >
          {viewMode === "kanban" ? (
            <ClientKanban clients={serializedClients} />
          ) : (
            <ClientTable
              clients={serializedClients}
              total={total}
              page={page}
              pageSize={pageSize}
              currentQ={q}
              currentStatus={params.status}
              currentSortBy={sortBy}
              currentSortOrder={sortOrder}
            />
          )}
        </Suspense>
      )}
    </div>
  );
}
