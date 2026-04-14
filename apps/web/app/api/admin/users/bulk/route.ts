import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import {
  handleInternalError,
  handleZodError,
  forbiddenResponse,
} from "@/lib/api-helpers";

const BulkSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("changeRole"),
    userIds: z.array(z.string()).min(1).max(100),
    platformRole: z.enum(["USER", "PLATFORM_ADMIN"]),
  }),
  z.object({
    action: z.literal("deactivate"),
    userIds: z.array(z.string()).min(1).max(100),
  }),
  z.object({
    action: z.literal("activate"),
    userIds: z.array(z.string()).min(1).max(100),
  }),
]);

export async function POST(request: NextRequest) {
  try {
    let currentUser;
    try {
      currentUser = await requirePlatformAdmin();
    } catch (err) {
      if (isRedirectError(err)) throw err;
      return forbiddenResponse();
    }

    const body = await request.json();
    const parsed = BulkSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const payload = parsed.data;

    // Prevent self from being in the list for role/deactivate
    if (payload.action === "changeRole" || payload.action === "deactivate") {
      if (payload.userIds.includes(currentUser.id)) {
        return forbiddenResponse("자기 자신은 일괄 작업 대상에서 제외되어야 합니다");
      }
    }

    // Last-admin check: if changing role to USER, make sure we don't demote all admins
    if (payload.action === "changeRole" && payload.platformRole === "USER") {
      const adminsBeingDemoted = await prisma.user.count({
        where: { id: { in: payload.userIds }, platformRole: "PLATFORM_ADMIN" },
      });
      const totalAdmins = await prisma.user.count({
        where: { platformRole: "PLATFORM_ADMIN" },
      });
      if (totalAdmins - adminsBeingDemoted < 1) {
        return forbiddenResponse(
          "이 작업을 수행하면 플랫폼 관리자가 없어집니다",
        );
      }
    }

    let count = 0;
    if (payload.action === "changeRole") {
      const result = await prisma.user.updateMany({
        where: { id: { in: payload.userIds } },
        data: { platformRole: payload.platformRole },
      });
      count = result.count;
    } else if (payload.action === "deactivate" || payload.action === "activate") {
      const result = await prisma.user.updateMany({
        where: { id: { in: payload.userIds } },
        data: { isActive: payload.action === "activate" },
      });
      count = result.count;
    }

    return NextResponse.json({ data: { updated: count } });
  } catch (err) {
    return handleInternalError(err);
  }
}
