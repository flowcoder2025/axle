import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";

type RouteContext = { params: Promise<{ token: string }> };

/**
 * GET /api/portal/[token]
 *
 * Validates the portal token and returns project + client info.
 * Returns 404 for invalid or expired tokens.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { token } = await params;

    const portalToken = await prisma.portalToken.findUnique({
      where: { token },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            status: true,
            dueDate: true,
            type: true,
            priority: true,
          },
        },
      },
    });

    if (!portalToken) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Invalid or expired portal link" } },
        { status: 404 },
      );
    }

    // Check expiry
    if (portalToken.expiresAt && portalToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: { code: "EXPIRED", message: "This portal link has expired" } },
        { status: 410 },
      );
    }

    // Fetch client info
    const client = await prisma.client.findUnique({
      where: { id: portalToken.clientId },
      select: { id: true, name: true, email: true, phone: true },
    });

    return NextResponse.json({
      data: {
        tokenId: portalToken.id,
        scope: portalToken.scope,
        project: portalToken.project,
        client,
        expiresAt: portalToken.expiresAt,
      },
    });
  } catch (err) {
    console.error("Portal token validation error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 },
    );
  }
}
