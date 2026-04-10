import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { emailLogQuerySchema } from "@/lib/validations/email-log";
import { handleZodError, handleInternalError, unauthorizedResponse } from "@/lib/api-helpers";
import { Prisma } from "@prisma/client";

// GET /api/email-logs — list email logs filtered by org boundary
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse();
    }
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const searchParams = Object.fromEntries(new URL(req.url).searchParams);
    const parsed = emailLogQuerySchema.safeParse(searchParams);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const { clientId, projectId, type, channel, dateFrom, dateTo, page, pageSize } = parsed.data;
    const skip = (page - 1) * pageSize;

    // Org boundary: EmailLog has no direct orgId.
    // Enforce via clientId → client.orgId OR projectId → project.client.orgId.
    // When neither filter is provided, include all logs reachable from this org.
    const orgConditions: Prisma.EmailLogWhereInput[] = [
      { clientId: { not: null }, client: { orgId: user.orgId } },
      { projectId: { not: null }, project: { client: { orgId: user.orgId } } },
      // meetingId-only logs scoped via the meeting's clientId
      {
        meetingId: { not: null },
        clientId: null,
        projectId: null,
        meeting: { client: { orgId: user.orgId } },
      },
    ];

    const where: Prisma.EmailLogWhereInput = {
      OR: orgConditions,
      ...(clientId ? { clientId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(type ? { type } : {}),
      ...(channel ? { channel } : {}),
      ...(dateFrom || dateTo
        ? {
            sentAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { sentAt: "desc" },
        select: {
          id: true,
          meetingId: true,
          clientId: true,
          projectId: true,
          to: true,
          subject: true,
          type: true,
          channel: true,
          resendMessageId: true,
          sentAt: true,
          openedAt: true,
        },
      }),
      prisma.emailLog.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (err) {
    return handleInternalError(err);
  }
}
