import { notFound } from "next/navigation";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { Button } from "@axle/ui";
import { ProgramTable } from "../../../src/components/programs/program-table";
import { ProgramCreateButton } from "../../../src/components/programs/program-create-button";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import type { ProgramCategory } from "@prisma/client";

export const metadata = {
  title: "지원사업 관리 | AXLE",
};

const VALID_CATEGORIES: ProgramCategory[] = [
  "STARTUP",
  "VENTURE",
  "RND",
  "CERTIFICATION",
  "EXPORT",
  "SMART_FACTORY",
  "GENERAL",
];

interface SearchParams {
  q?: string;
  category?: string;
  region?: string;
  hasDeadline?: string;
  page?: string;
  pageSize?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ProgramsPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function ProgramsPage({
  searchParams,
}: ProgramsPageProps) {
  const user = await getCurrentUser();
  if (!user?.orgId) notFound();

  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize ?? "20") || 20));
  const skip = (page - 1) * pageSize;

  const category = VALID_CATEGORIES.includes(params.category as ProgramCategory)
    ? (params.category as ProgramCategory)
    : undefined;
  const region = params.region?.trim() || undefined;

  const hasDeadlineParam = params.hasDeadline;
  const hasDeadlineFilter =
    hasDeadlineParam === "true"
      ? true
      : hasDeadlineParam === "false"
      ? false
      : undefined;

  const VALID_SORT_FIELDS = ["applicationEnd", "name", "createdAt"] as const;
  type SortField = (typeof VALID_SORT_FIELDS)[number];
  const sortBy: SortField = VALID_SORT_FIELDS.includes(
    params.sortBy as SortField
  )
    ? (params.sortBy as SortField)
    : "applicationEnd";
  const sortOrder: "asc" | "desc" =
    params.sortOrder === "desc" ? "desc" : "asc";

  const where = {
    orgId: user.orgId,
    ...(category ? { category } : {}),
    ...(region ? { region: { contains: region, mode: "insensitive" as const } } : {}),
    ...(hasDeadlineFilter === true ? { applicationEnd: { not: null } } : {}),
    ...(hasDeadlineFilter === false ? { applicationEnd: null } : {}),
  };

  const [programs, total] = await Promise.all([
    prisma.programInfo.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        name: true,
        agency: true,
        category: true,
        applicationStart: true,
        applicationEnd: true,
        maxFunding: true,
        region: true,
        _count: { select: { matchingResults: true, schedules: true } },
      },
    }),
    prisma.programInfo.count({ where }),
  ]);

  // Serialize dates and decimals for client components
  const serializedPrograms = programs.map((p) => ({
    ...p,
    applicationStart: p.applicationStart
      ? p.applicationStart.toISOString()
      : null,
    applicationEnd: p.applicationEnd ? p.applicationEnd.toISOString() : null,
    maxFunding: p.maxFunding ? p.maxFunding.toString() : null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">지원사업 관리</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            등록된 지원사업을 조회하고 관리합니다.
          </p>
        </div>
        <Suspense>
          <ProgramCreateButton />
        </Suspense>
      </div>

      <Suspense
        fallback={
          <div className="py-8 text-center text-muted-foreground">
            불러오는 중...
          </div>
        }
      >
        <ProgramTable
          programs={serializedPrograms}
          total={total}
          page={page}
          pageSize={pageSize}
          currentCategory={params.category}
          currentSortBy={sortBy}
          currentSortOrder={sortOrder}
        />
      </Suspense>
    </div>
  );
}
