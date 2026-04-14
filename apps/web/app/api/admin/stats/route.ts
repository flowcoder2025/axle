import { NextResponse } from "next/server";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import { handleInternalError, forbiddenResponse } from "@/lib/api-helpers";

export async function GET() {
  try {
    let user;
    try {
      user = await requirePlatformAdmin();
    } catch (err) {
      if (isRedirectError(err)) throw err;
      return forbiddenResponse();
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalOrgs, totalUsers, newUsersThisWeek, activeOrgs] = await Promise.all([
      prisma.organization.count(),
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.organization.count({ where: { isSuspended: false } }),
    ]);

    return NextResponse.json({
      data: {
        totalOrgs,
        totalUsers,
        newUsersThisWeek,
        activeOrgs,
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
