import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { automationLogSearchSchema } from "@/lib/validations/automation-log";
import { handleZodError, handleInternalError, unauthorizedResponse } from "@/lib/api-helpers";
import { Prisma } from "@prisma/client";

/**
 * GET /api/automation-logs
 *
 * Query params:
 *   clientId  — filter by client (must belong to caller's org)
 *   type      — AutoType enum filter
 *   status    — JobStatus enum filter
 *   page      — 1-based (default 1)
 *   pageSize  — max 100 (default 20)
 *
 * Org boundary: only returns logs whose clientId is owned by the caller's org.
 * Logs with no clientId (org-level) are included when no clientId filter is set.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const searchParams = Object.fromEntries(new URL(req.url).searchParams);
    const parsed = automationLogSearchSchema.safeParse(searchParams);
    if (!parsed.success) return handleZodError(parsed.error);

    const { clientId, type, status, page, pageSize } = parsed.data;
    const skip = (page - 1) * pageSize;

    // Enforce org boundary: fetch client IDs that belong to this org
    let allowedClientIds: string[] | undefined;
    if (clientId) {
      // Verify the requested clientId belongs to the org
      const client = await prisma.client.findFirst({
        where: { id: clientId, orgId: user.orgId },
        select: { id: true },
      });
      if (!client) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Client not found" } },
          { status: 404 }
        );
      }
      allowedClientIds = [clientId];
    } else {
      // All clients in the org
      const orgClients = await prisma.client.findMany({
        where: { orgId: user.orgId },
        select: { id: true },
      });
      allowedClientIds = orgClients.map((c) => c.id);
    }

    const where: Prisma.AutomationLogWhereInput = {
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
      // Include logs linked to org clients OR logs with no client (org-level)
      OR: [
        { clientId: { in: allowedClientIds } },
        ...(clientId ? [] : [{ clientId: null }]),
      ],
    };

    const [logs, total] = await Promise.all([
      prisma.automationLog.findMany({
        where,
        orderBy: { executedAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.automationLog.count({ where }),
    ]);

    return NextResponse.json({
      data: logs,
      meta: {
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
