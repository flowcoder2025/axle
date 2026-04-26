import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import {
  handleInternalError,
  notFoundResponse,
  unauthorizedResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ clientId: string }> };

/**
 * GET /api/clients/[clientId]/portal-credentials
 *
 * Lists certificates and portal accounts attached to the client. Plaintext
 * passwords / PFX bytes are NEVER returned — only metadata for UI display.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user?.orgId) return unauthorizedResponse();

    const { clientId } = await params;
    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
      select: { id: true },
    });
    if (!client) return notFoundResponse("Client");

    const [certificates, accounts] = await Promise.all([
      prisma.clientCertificate.findMany({
        where: { clientId },
        select: {
          id: true,
          subject: true,
          issuer: true,
          serialNumber: true,
          validFrom: true,
          validTo: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.clientPortalAccount.findMany({
        where: { clientId },
        select: {
          id: true,
          portal: true,
          userId: true,
          createdAt: true,
        },
        orderBy: { portal: "asc" },
      }),
    ]);

    return NextResponse.json({ data: { certificates, accounts } });
  } catch (err) {
    return handleInternalError(err);
  }
}
