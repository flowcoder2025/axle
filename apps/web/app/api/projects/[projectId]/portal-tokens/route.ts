import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { z } from "zod";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
} from "@/lib/api-helpers";
import { resolveProject } from "@/lib/utils/resolve-project";

type RouteContext = { params: Promise<{ projectId: string }> };

const portalTokenCreateSchema = z.object({
  scope: z.enum(["FULL", "UPLOAD", "JOURNAL"]).default("FULL"),
  expiresAt: z.string().datetime().optional().nullable(),
});

/**
 * GET /api/projects/[projectId]/portal-tokens
 * Lists all portal tokens for the project.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { projectId } = await params;
    const resolved = await resolveProject(projectId, user.orgId);
    if (!resolved.ok) return resolved.response;

    const tokens = await prisma.portalToken.findMany({
      where: { projectId },
      select: {
        id: true,
        token: true,
        scope: true,
        expiresAt: true,
        createdBy: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: tokens });
  } catch (err) {
    return handleInternalError(err);
  }
}

/**
 * POST /api/projects/[projectId]/portal-tokens
 * Creates a new portal token for the project.
 *
 * Body: { scope?: "FULL" | "UPLOAD" | "JOURNAL", expiresAt?: ISO string }
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { projectId } = await params;
    const resolved = await resolveProject(projectId, user.orgId);
    if (!resolved.ok) return resolved.response;

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

    const project = resolved.project;

    const portalToken = await prisma.portalToken.create({
      data: {
        projectId,
        clientId: project.clientId,
        scope: parsed.data.scope,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        createdBy: user.id,
      },
      select: {
        id: true,
        token: true,
        scope: true,
        expiresAt: true,
        createdBy: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: portalToken }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}
