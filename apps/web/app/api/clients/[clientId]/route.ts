import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { clientUpdateSchema } from "@/lib/validations/client";
import { handleZodError, handleInternalError, unauthorizedResponse, notFoundResponse } from "@/lib/api-helpers";
import { Prisma } from "@prisma/client";

type RouteContext = { params: Promise<{ clientId: string }> };

// GET /api/clients/[clientId] — single client with contacts and project count
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse();
    }
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const { clientId } = await ctx.params;

    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
      include: {
        contacts: {
          select: {
            id: true,
            name: true,
            position: true,
            department: true,
            phone: true,
            email: true,
            isPrimary: true,
            source: true,
            isResearcher: true,
          },
        },
        _count: {
          select: { projects: true },
        },
      },
    });

    if (!client) {
      return notFoundResponse("Client");
    }

    return NextResponse.json({ data: client });
  } catch (err) {
    return handleInternalError(err);
  }
}

// PATCH /api/clients/[clientId] — partial update
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse();
    }
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const { clientId } = await ctx.params;

    const existing = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
      select: { id: true },
    });

    if (!existing) {
      return notFoundResponse("Client");
    }

    const body = await req.json();
    const parsed = clientUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const {
      foundedDate,
      ventureValidUntil,
      capitalAmount,
      masterProfile,
      profileBlocks,
      ...rest
    } = parsed.data;

    const client = await prisma.client.update({
      where: { id: clientId },
      data: {
        ...rest,
        ...(foundedDate !== undefined
          ? { foundedDate: foundedDate ? new Date(foundedDate) : null }
          : {}),
        ...(ventureValidUntil !== undefined
          ? { ventureValidUntil: ventureValidUntil ? new Date(ventureValidUntil) : null }
          : {}),
        ...(capitalAmount !== undefined ? { capitalAmount } : {}),
        ...(masterProfile !== undefined
          ? {
              masterProfile: masterProfile != null
                ? (masterProfile as Prisma.InputJsonValue)
                : Prisma.DbNull,
            }
          : {}),
        ...(profileBlocks !== undefined
          ? {
              profileBlocks: profileBlocks != null
                ? (profileBlocks as Prisma.InputJsonValue)
                : Prisma.DbNull,
            }
          : {}),
      },
    });

    return NextResponse.json({ data: client });
  } catch (err) {
    return handleInternalError(err);
  }
}

// DELETE /api/clients/[clientId]
// Soft delete (status → INACTIVE) by default; hard delete if ?hard=true
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse();
    }
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const { clientId } = await ctx.params;
    const hardDelete = new URL(req.url).searchParams.get("hard") === "true";

    const existing = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
      select: { id: true },
    });

    if (!existing) {
      return notFoundResponse("Client");
    }

    if (hardDelete) {
      await prisma.client.delete({ where: { id: clientId } });
      return NextResponse.json({ data: { deleted: true } });
    }

    const client = await prisma.client.update({
      where: { id: clientId },
      data: { status: "INACTIVE" },
    });

    return NextResponse.json({ data: client });
  } catch (err) {
    return handleInternalError(err);
  }
}
