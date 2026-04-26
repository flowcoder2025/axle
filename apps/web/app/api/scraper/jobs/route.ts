import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@axle/db";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@axle/auth";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/api-helpers";
import { scraperJobCreateSchema } from "@/lib/validations/scraper-job";

export const dynamic = "force-dynamic";

/**
 * POST /api/scraper/jobs
 *
 * Internal endpoint — called from the AXLE web UI (session auth) to enqueue
 * a new scraper job. The scraper itself does NOT call this; it polls
 * GET /api/scraper/jobs/next instead.
 *
 * Body: ScraperJobCreateInput
 *
 * Returns 201 { jobId, status: "QUEUED" }.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) return forbiddenResponse("No active organization");

    const body = await req.json().catch(() => null);
    const parsed = scraperJobCreateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const input = parsed.data;

    // Verify client belongs to user's org.
    const client = await prisma.client.findFirst({
      where: { id: input.clientId, orgId: user.orgId },
      select: { id: true },
    });
    if (!client) return notFoundResponse("Client");

    // Verify credentialsRef points to a record owned by the same client.
    if (input.credentialsKind === "CERTIFICATE") {
      const cert = await prisma.clientCertificate.findFirst({
        where: { id: input.credentialsRef, clientId: input.clientId },
        select: { id: true, validTo: true },
      });
      if (!cert) return notFoundResponse("ClientCertificate");
      if (cert.validTo < new Date()) {
        return NextResponse.json(
          { error: { code: "CERT_EXPIRED", message: "Certificate has expired" } },
          { status: 422 },
        );
      }
    } else {
      const account = await prisma.clientPortalAccount.findFirst({
        where: { id: input.credentialsRef, clientId: input.clientId },
        select: { id: true },
      });
      if (!account) return notFoundResponse("ClientPortalAccount");
    }

    const job = await prisma.scraperJob.create({
      data: {
        orgId: user.orgId,
        clientId: input.clientId,
        type: input.type,
        target: input.target,
        params: (input.params ?? {}) as Prisma.InputJsonValue,
        credentialsKind: input.credentialsKind,
        credentialsRef: input.credentialsRef,
        createdById: user.id,
        status: "QUEUED",
      },
      select: { id: true, status: true },
    });

    return NextResponse.json({ jobId: job.id, status: job.status }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}
