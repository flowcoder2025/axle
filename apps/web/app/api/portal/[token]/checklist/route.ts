import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";

type RouteContext = { params: Promise<{ token: string }> };

/**
 * GET /api/portal/[token]/checklist
 *
 * Returns a read-only view of the project checklist for portal users.
 * Token must be FULL or UPLOAD scope (JOURNAL-only tokens cannot see checklist).
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { token } = await params;

    const portalToken = await prisma.portalToken.findUnique({
      where: { token },
      select: { projectId: true, clientId: true, scope: true, expiresAt: true },
    });

    if (!portalToken) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Invalid portal link" } },
        { status: 404 },
      );
    }

    if (portalToken.expiresAt && portalToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: { code: "EXPIRED", message: "This portal link has expired" } },
        { status: 410 },
      );
    }

    if (portalToken.scope === "JOURNAL") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "This portal link does not allow checklist access" } },
        { status: 403 },
      );
    }

    // Client-level tokens (projectId = null) expose checklist items for every
    // project that belongs to the client; project-scoped tokens stay restricted
    // to just that project.
    const items = await prisma.checklistItem.findMany({
      where: portalToken.projectId
        ? { projectId: portalToken.projectId }
        : { project: { clientId: portalToken.clientId } },
      select: {
        id: true,
        name: true,
        description: true,
        isRequired: true,
        status: true,
        requestedAt: true,
        uploadedAt: true,
      },
      orderBy: [{ isRequired: "desc" }, { status: "asc" }],
    });

    return NextResponse.json({ data: items });
  } catch (err) {
    console.error("Portal checklist error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 },
    );
  }
}
