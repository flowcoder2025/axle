import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import { handleInternalError, forbiddenResponse } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  try {
    const user = await requireOrgAdmin().catch(() => null);
    if (!user) return forbiddenResponse();

    const { searchParams } = request.nextUrl;
    const days = Math.min(parseInt(searchParams.get("days") ?? "30"), 90);

    const since = new Date();
    since.setDate(since.getDate() - days);

    const memberActivity = await prisma.analyticsEvent.groupBy({
      by: ["userId"],
      where: {
        orgId: user.orgId,
        userId: { not: null },
        createdAt: { gte: since },
      },
      _count: true,
      orderBy: { _count: { userId: "desc" } },
    });

    const userIds = memberActivity.map((m) => m.userId!);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, image: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const members = memberActivity.map((m) => ({
      user: userMap.get(m.userId!) ?? {
        id: m.userId,
        name: null,
        email: null,
        image: null,
      },
      eventCount: m._count,
    }));

    return NextResponse.json({ data: { members } });
  } catch (err) {
    return handleInternalError(err);
  }
}
