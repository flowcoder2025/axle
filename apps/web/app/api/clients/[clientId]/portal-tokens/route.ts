import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { z } from "zod";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ clientId: string }> };

const portalTokenCreateSchema = z.object({
  scope: z.enum(["FULL", "UPLOAD", "JOURNAL"]).default("UPLOAD"),
  expiresAt: z.string().datetime().optional().nullable(),
});

async function resolveClient(clientId: string, orgId: string) {
  return prisma.client.findFirst({
    where: { id: clientId, orgId },
    select: { id: true },
  });
}

/**
 * GET /api/clients/[clientId]/portal-tokens
 * Lists every portal token associated with the client (both client-level and
 * project-level), so the "서류 요청" tab can surface the full history.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { clientId } = await params;
    const client = await resolveClient(clientId, user.orgId);
    if (!client) return notFoundResponse("Client");

    const tokens = await prisma.portalToken.findMany({
      where: { clientId },
      select: {
        id: true,
        token: true,
        scope: true,
        expiresAt: true,
        createdBy: true,
        createdAt: true,
        projectId: true,
        project: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: tokens });
  } catch (err) {
    return handleInternalError(err);
  }
}

/**
 * POST /api/clients/[clientId]/portal-tokens
 * Creates a client-level portal token (projectId = null).
 *
 * Body: { scope?: "FULL" | "UPLOAD" | "JOURNAL", expiresAt?: ISO string }
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { clientId } = await params;
    const client = await resolveClient(clientId, user.orgId);
    if (!client) return notFoundResponse("Client");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const parsed = portalTokenCreateSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const portalToken = await prisma.portalToken.create({
      data: {
        clientId,
        scope: parsed.data.scope,
        expiresAt: parsed.data.expiresAt
          ? new Date(parsed.data.expiresAt)
          : null,
        createdBy: user.id,
      },
      select: {
        id: true,
        token: true,
        scope: true,
        expiresAt: true,
        createdBy: true,
        createdAt: true,
        projectId: true,
      },
    });

    return NextResponse.json({ data: portalToken }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}
