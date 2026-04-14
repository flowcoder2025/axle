import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import { UsersTable } from "./users-table";

type Props = {
  searchParams: Promise<{
    search?: string;
    role?: "USER" | "PLATFORM_ADMIN";
    status?: "active" | "inactive";
    page?: string;
    sort?: "createdAt" | "name";
    order?: "asc" | "desc";
  }>;
};

export default async function UsersPage({ searchParams }: Props) {
  const currentUser = await requirePlatformAdmin();
  const sp = await searchParams;

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = 20;
  const sort = sp.sort ?? "createdAt";
  const order = sp.order ?? "desc";

  const where = {
    ...(sp.search
      ? {
          OR: [
            { name: { contains: sp.search, mode: "insensitive" as const } },
            { email: { contains: sp.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(sp.role ? { platformRole: sp.role } : {}),
    ...(sp.status === "active"
      ? { isActive: true }
      : sp.status === "inactive"
        ? { isActive: false }
        : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        platformRole: true,
        isActive: true,
        createdAt: true,
        memberships: {
          select: {
            role: true,
            organization: { select: { id: true, name: true } },
          },
          take: 1,
        },
      },
      orderBy: { [sort]: order },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const rows = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image,
    platformRole: u.platformRole,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
    orgs: u.memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      role: m.role,
    })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">사용자 관리</h1>
        <p className="text-sm text-muted-foreground">플랫폼 전체 사용자를 관리합니다</p>
      </div>
      <UsersTable
        users={rows}
        currentUserId={currentUser.id}
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
