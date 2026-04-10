import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { Prisma } from "@prisma/client";
import {
  estimateCreateSchema,
  estimateSearchSchema,
} from "@/lib/validations/estimate";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
} from "@/lib/api-helpers";
import { generateEstimateNumber } from "@/lib/utils/number-generator";

// GET /api/estimates — list estimates with filtering and pagination
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const searchParams = Object.fromEntries(new URL(req.url).searchParams);
    const parsed = estimateSearchSchema.safeParse(searchParams);
    if (!parsed.success) return handleZodError(parsed.error);

    const { clientId, projectId, status, page, pageSize } = parsed.data;
    const skip = (page - 1) * pageSize;

    const where: Prisma.EstimateWhereInput = {
      // Org boundary via client
      client: { orgId: user.orgId },
      ...(clientId ? { clientId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(status ? { status } : {}),
    };

    const [estimates, total] = await Promise.all([
      prisma.estimate.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          estimateNumber: true,
          clientId: true,
          projectId: true,
          totalAmount: true,
          taxAmount: true,
          status: true,
          validUntil: true,
          sentAt: true,
          createdAt: true,
          client: { select: { name: true } },
        },
      }),
      prisma.estimate.count({ where }),
    ]);

    return NextResponse.json({ data: estimates, total, page, pageSize });
  } catch (err) {
    return handleInternalError(err);
  }
}

// POST /api/estimates — create estimate with auto-generated estimateNumber
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = estimateCreateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { clientId, projectId, items, totalAmount, taxAmount, validUntil } =
      parsed.data;

    // Org boundary: verify client belongs to this org
    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    const estimateNumber = await generateEstimateNumber(prisma);

    const estimate = await prisma.estimate.create({
      data: {
        clientId,
        projectId: projectId ?? null,
        estimateNumber,
        items: items as Prisma.InputJsonValue,
        totalAmount,
        taxAmount: taxAmount ?? null,
        validUntil: validUntil ? new Date(validUntil) : null,
        status: "DRAFT",
      },
    });

    return NextResponse.json({ data: estimate }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}
