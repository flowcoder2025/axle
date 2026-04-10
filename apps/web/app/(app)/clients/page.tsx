import Link from "next/link";
import { Button } from "@axle/ui";
import { ClientTable } from "../../../src/components/clients/client-table";
import { Plus } from "lucide-react";
import { Suspense } from "react";

export const metadata = {
  title: "고객사 관리 | AXLE",
};

interface SearchParams {
  q?: string;
  status?: string;
  page?: string;
  pageSize?: string;
  sortBy?: string;
  sortOrder?: string;
}

async function fetchClients(searchParams: SearchParams) {
  const params = new URLSearchParams();
  if (searchParams.q) params.set("q", searchParams.q);
  if (searchParams.status) params.set("status", searchParams.status);
  if (searchParams.page) params.set("page", searchParams.page);
  if (searchParams.pageSize) params.set("pageSize", searchParams.pageSize);
  if (searchParams.sortBy) params.set("sortBy", searchParams.sortBy);
  if (searchParams.sortOrder) params.set("sortOrder", searchParams.sortOrder);

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/clients?${params.toString()}`, {
    cache: "no-store",
    headers: {
      // Pass cookies so auth works server-side
      Cookie: "",
    },
  });

  if (!res.ok) {
    return { data: [], total: 0, page: 1, pageSize: 20 };
  }

  return res.json() as Promise<{
    data: Array<{
      id: string;
      name: string;
      ceoName?: string | null;
      status: "ACTIVE" | "INACTIVE" | "PROSPECT";
      assignedTo?: string | null;
      updatedAt: string;
      industry?: string | null;
      region?: string | null;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }>;
}

interface ClientsPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const params = await searchParams;
  const result = await fetchClients(params);

  const page = Number(params.page ?? "1");
  const pageSize = Number(params.pageSize ?? "20");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">고객사 관리</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            등록된 고객사를 조회하고 관리합니다.
          </p>
        </div>
        <Button asChild>
          <Link href="/clients/new">
            <Plus className="mr-2 h-4 w-4" />
            고객사 추가
          </Link>
        </Button>
      </div>

      <Suspense fallback={<div className="py-8 text-center text-muted-foreground">불러오는 중...</div>}>
        <ClientTable
          clients={result.data}
          total={result.total}
          page={page}
          pageSize={pageSize}
          currentQ={params.q}
          currentStatus={params.status}
          currentSortBy={
            (params.sortBy as "name" | "createdAt" | "updatedAt" | "status") ??
            "createdAt"
          }
          currentSortOrder={
            (params.sortOrder as "asc" | "desc") ?? "desc"
          }
        />
      </Suspense>
    </div>
  );
}
