import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import {
  handleInternalError,
  notFoundResponse,
  unauthorizedResponse,
} from "@/lib/api-helpers";

type RouteContext = {
  params: Promise<{ clientId: string; accountId: string }>;
};

/**
 * DELETE /api/clients/[clientId]/portal-credentials/accounts/[accountId]
 *
 * Removes a stored portal account. Blocked if a non-terminal scraper job
 * is still pointing at it.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user?.orgId) return unauthorizedResponse();

    const { clientId, accountId } = await params;

    const account = await prisma.clientPortalAccount.findFirst({
      where: { id: accountId, clientId, client: { orgId: user.orgId } },
      select: { id: true },
    });
    if (!account) return notFoundResponse("ClientPortalAccount");

    const inUse = await prisma.scraperJob.count({
      where: {
        credentialsKind: "USERPW",
        credentialsRef: accountId,
        status: { in: ["QUEUED", "PICKED_UP", "RUNNING"] },
      },
    });
    if (inUse > 0) {
      return NextResponse.json(
        {
          error: {
            code: "ACCOUNT_IN_USE",
            message: "Account is referenced by an active scraper job",
          },
        },
        { status: 409 },
      );
    }

    await prisma.clientPortalAccount.delete({ where: { id: accountId } });
    return NextResponse.json({ data: { id: accountId } });
  } catch (err) {
    return handleInternalError(err);
  }
}
