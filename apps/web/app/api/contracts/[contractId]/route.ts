import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { Prisma } from "@prisma/client";
import { contractUpdateSchema } from "@/lib/validations/contract";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

interface RouteContext {
  params: Promise<{ contractId: string }>;
}

// GET /api/contracts/[contractId]
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

    const { contractId } = await params;
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, client: { orgId: user.orgId } },
      include: { client: { select: { name: true, email: true } } },
    });

    if (!contract) return notFoundResponse("Contract");
    return NextResponse.json({ data: contract });
  } catch (err) {
    return handleInternalError(err);
  }
}

// PATCH /api/contracts/[contractId]
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

    const { contractId } = await params;
    const existing = await prisma.contract.findFirst({
      where: { id: contractId, client: { orgId: user.orgId } },
      select: { id: true },
    });
    if (!existing) return notFoundResponse("Contract");

    const body = await req.json();
    const parsed = contractUpdateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const {
      partyA,
      partyB,
      terms,
      startDate,
      endDate,
      totalAmount,
      projectId,
      ...rest
    } = parsed.data;

    const updated = await prisma.contract.update({
      where: { id: contractId },
      data: {
        ...rest,
        ...(partyA !== undefined
          ? { partyA: partyA as Prisma.InputJsonValue }
          : {}),
        ...(partyB !== undefined
          ? { partyB: partyB as Prisma.InputJsonValue }
          : {}),
        ...(terms !== undefined
          ? { terms: terms as Prisma.InputJsonValue }
          : {}),
        ...(startDate !== undefined
          ? { startDate: startDate ? new Date(startDate) : null }
          : {}),
        ...(endDate !== undefined
          ? { endDate: endDate ? new Date(endDate) : null }
          : {}),
        ...(totalAmount !== undefined ? { totalAmount } : {}),
        ...(projectId !== undefined ? { projectId } : {}),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleInternalError(err);
  }
}

// DELETE /api/contracts/[contractId]
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

    const { contractId } = await params;
    const existing = await prisma.contract.findFirst({
      where: { id: contractId, client: { orgId: user.orgId } },
      select: { id: true },
    });
    if (!existing) return notFoundResponse("Contract");

    await prisma.contract.delete({ where: { id: contractId } });
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    return handleInternalError(err);
  }
}
