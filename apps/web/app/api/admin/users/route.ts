import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import { handleInternalError, handleZodError, forbiddenResponse } from "@/lib/api-helpers";

const QuerySchema = z.object({
  search: z.string().max(200).optional(),
  role: z.enum(["USER", "PLATFORM_ADMIN"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["createdAt", "name"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export async function GET(request: NextRequest) {
  try {
    try {
      await requirePlatformAdmin();
    } catch (err) {
      if (isRedirectError(err)) throw err;
      return forbiddenResponse();
    }

    const parsed = QuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) return handleZodError(parsed.error);

    const { search, role, status, page, pageSize, sort, order } = parsed.data;

    const where = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(role ? { platformRole: role } : {}),
      ...(status === "active" ? { isActive: true } : status === "inactive" ? { isActive: false } : {}),
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
          },
        },
        orderBy: { [sort]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      data: users.map((u) => ({
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
      })),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
