import { NextRequest, NextResponse } from "next/server";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import { handleInternalError, forbiddenResponse } from "@/lib/api-helpers";
import { toCsv } from "@/lib/admin/csv";

const MAX_EXPORT = 10_000;

export async function GET(_request: NextRequest) {
  try {
    try {
      await requirePlatformAdmin();
    } catch (err) {
      if (isRedirectError(err)) throw err;
      return forbiddenResponse();
    }

    const users = await prisma.user.findMany({
      take: MAX_EXPORT,
      select: {
        id: true,
        name: true,
        email: true,
        platformRole: true,
        isActive: true,
        createdAt: true,
        memberships: {
          select: {
            organization: { select: { name: true } },
            role: true,
          },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const headers = ["ID", "이름", "이메일", "플랫폼 역할", "소속 조직", "조직 내 역할", "활성", "가입일"];
    const rows = users.map((u) => [
      u.id,
      u.name ?? "",
      u.email,
      u.platformRole,
      u.memberships[0]?.organization.name ?? "",
      u.memberships[0]?.role ?? "",
      u.isActive ? "Y" : "N",
      u.createdAt.toISOString(),
    ]);

    const csv = toCsv(headers, rows);
    const filename = `axle-users-${new Date().toISOString().split("T")[0]}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
