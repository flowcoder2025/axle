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
  params: Promise<{ clientId: string; certId: string }>;
};

/**
 * DELETE /api/clients/[clientId]/portal-credentials/certificates/[certId]
 *
 * Removes a stored certificate. If the certificate is referenced by any
 * non-terminal `ScraperJob` (QUEUED / PICKED_UP / RUNNING), deletion is
 * blocked to prevent the scraper from getting a 404 mid-run.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user?.orgId) return unauthorizedResponse();

    const { clientId, certId } = await params;

    const cert = await prisma.clientCertificate.findFirst({
      where: { id: certId, clientId, client: { orgId: user.orgId } },
      select: { id: true },
    });
    if (!cert) return notFoundResponse("ClientCertificate");

    const inUse = await prisma.scraperJob.count({
      where: {
        credentialsKind: "CERTIFICATE",
        credentialsRef: certId,
        status: { in: ["QUEUED", "PICKED_UP", "RUNNING"] },
      },
    });
    if (inUse > 0) {
      return NextResponse.json(
        {
          error: {
            code: "CERTIFICATE_IN_USE",
            message: "Certificate is referenced by an active scraper job",
          },
        },
        { status: 409 },
      );
    }

    await prisma.clientCertificate.delete({ where: { id: certId } });
    return NextResponse.json({ data: { id: certId } });
  } catch (err) {
    return handleInternalError(err);
  }
}
