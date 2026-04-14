import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import {
  handleInternalError,
  handleZodError,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/api-helpers";
import {
  guardSelfDemotion,
  guardLastAdminDemotion,
  guardSelfDeactivation,
  ForbiddenError,
} from "@/lib/admin/user-guards";

const PatchSchema = z
  .object({
    platformRole: z.enum(["USER", "PLATFORM_ADMIN"]).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field required",
  });

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    try {
      await requirePlatformAdmin();
    } catch (err) {
      if (isRedirectError(err)) throw err;
      return forbiddenResponse();
    }

    const { userId } = await params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
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
            organization: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    if (!user) return notFoundResponse("User");

    const recentEvents = await prisma.analyticsEvent.findMany({
      where: {
        userId,
        category: { in: ["BUSINESS", "FEATURE_USE"] },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        action: true,
        category: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      data: {
        user: { ...user, createdAt: user.createdAt.toISOString() },
        recentEvents: recentEvents.map((e) => ({
          ...e,
          createdAt: e.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    let currentUser;
    try {
      currentUser = await requirePlatformAdmin();
    } catch (err) {
      if (isRedirectError(err)) throw err;
      return forbiddenResponse();
    }

    const { userId } = await params;
    const body = await request.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { platformRole, isActive } = parsed.data;

    try {
      if (platformRole !== undefined) {
        guardSelfDemotion(currentUser.id, userId);
        await guardLastAdminDemotion(userId, platformRole);
      }
      if (isActive !== undefined) {
        guardSelfDeactivation(currentUser.id, userId, isActive);
      }
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return forbiddenResponse(err.message);
      }
      throw err;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(platformRole !== undefined ? { platformRole } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      select: {
        id: true,
        platformRole: true,
        isActive: true,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleInternalError(err);
  }
}
