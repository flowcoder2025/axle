import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { Prisma } from "@prisma/client";
import { estimateUpdateSchema } from "@/lib/validations/estimate";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

interface RouteContext {
  params: Promise<{ estimateId: string }>;
}

// GET /api/estimates/[estimateId]
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const { estimateId } = await params;
    const estimate = await prisma.estimate.findFirst({
      where: { id: estimateId, client: { orgId: user.orgId } },
      include: { client: { select: { name: true, email: true } } },
    });

    if (!estimate) return notFoundResponse("Estimate");
    return NextResponse.json({ data: estimate });
  } catch (err) {
    return handleInternalError(err);
  }
}

// PATCH /api/estimates/[estimateId]
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const { estimateId } = await params;
    const existing = await prisma.estimate.findFirst({
      where: { id: estimateId, client: { orgId: user.orgId } },
      select: { id: true },
    });
    if (!existing) return notFoundResponse("Estimate");

    const body = await req.json();
    const parsed = estimateUpdateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { items, validUntil, taxAmount, projectId, ...rest } = parsed.data;

    const updated = await prisma.estimate.update({
      where: { id: estimateId },
      data: {
        ...rest,
        ...(items !== undefined
          ? { items: items as Prisma.InputJsonValue }
          : {}),
        ...(validUntil !== undefined
          ? { validUntil: validUntil ? new Date(validUntil) : null }
          : {}),
        ...(taxAmount !== undefined ? { taxAmount } : {}),
        ...(projectId !== undefined ? { projectId } : {}),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleInternalError(err);
  }
}

// DELETE /api/estimates/[estimateId]
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const { estimateId } = await params;
    const existing = await prisma.estimate.findFirst({
      where: { id: estimateId, client: { orgId: user.orgId } },
      select: { id: true },
    });
    if (!existing) return notFoundResponse("Estimate");

    await prisma.estimate.delete({ where: { id: estimateId } });
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    return handleInternalError(err);
  }
}
