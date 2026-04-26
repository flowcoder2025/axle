import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import {
  handleZodError,
  handleInternalError,
  notFoundResponse,
  unauthorizedResponse,
} from "@/lib/api-helpers";
import { portalAccountCreateSchema } from "@/lib/validations/portal-credential";
import { encryptCredential } from "@/lib/scraper-crypto";

type RouteContext = { params: Promise<{ clientId: string }> };

/**
 * POST /api/clients/[clientId]/portal-credentials/accounts
 *
 * Stores a userId/password pair for portals that authenticate without a
 * public certificate. Password is AES-256-GCM encrypted at rest. Only one
 * account per (client, portal) is permitted (DB unique constraint) — POST
 * with an existing portal returns 409.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user?.orgId) return unauthorizedResponse();

    const { clientId } = await params;
    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
      select: { id: true },
    });
    if (!client) return notFoundResponse("Client");

    const body = await req.json().catch(() => null);
    const parsed = portalAccountCreateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    try {
      const account = await prisma.clientPortalAccount.create({
        data: {
          clientId,
          portal: parsed.data.portal,
          userId: parsed.data.userId,
          passwordCiphertext: encryptCredential(parsed.data.password),
          createdById: user.id,
        },
        select: {
          id: true,
          portal: true,
          userId: true,
          createdAt: true,
        },
      });
      return NextResponse.json({ data: account }, { status: 201 });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return NextResponse.json(
          {
            error: {
              code: "PORTAL_ACCOUNT_EXISTS",
              message: "An account for this portal already exists",
            },
          },
          { status: 409 },
        );
      }
      throw err;
    }
  } catch (err) {
    return handleInternalError(err);
  }
}
