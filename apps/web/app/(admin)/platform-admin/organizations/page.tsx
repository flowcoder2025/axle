import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import { OrgsTable } from "./orgs-table";

type Props = {
  searchParams: Promise<{
    search?: string;
    page?: string;
    sort?: "createdAt" | "name" | "memberCount";
    order?: "asc" | "desc";
  }>;
};

export default async function OrganizationsPage({ searchParams }: Props) {
  await requirePlatformAdmin();
  const sp = await searchParams;

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = 20;
  const sort = sp.sort ?? "createdAt";
  const order = sp.order ?? "desc";

  const where = sp.search
    ? {
        OR: [
          { name: { contains: sp.search, mode: "insensitive" as const } },
          { slug: { contains: sp.search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, orgs] = await Promise.all([
    prisma.organization.count({ where }),
    prisma.organization.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        isSuspended: true,
        createdAt: true,
        _count: { select: { memberships: true } },
      },
      orderBy:
        sort === "memberCount"
          ? { memberships: { _count: order } }
          : { [sort]: order },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const rows = orgs.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    plan: o.plan,
    isSuspended: o.isSuspended,
    memberCount: o._count.memberships,
    createdAt: o.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">조직 관리</h1>
        <p className="text-sm text-muted-foreground">플랫폼 전체 조직을 관리합니다</p>
      </div>
      <OrgsTable
        orgs={rows}
        pagination={{
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        }}
      />
    </div>
  );
}
