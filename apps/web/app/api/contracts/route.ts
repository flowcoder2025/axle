import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { Prisma } from "@prisma/client";
import {
  contractCreateSchema,
  contractSearchSchema,
} from "@/lib/validations/contract";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
} from "@/lib/api-helpers";
import { generateContractNumber } from "@/lib/utils/number-generator";

// GET /api/contracts — list contracts with filtering and pagination
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
    const parsed = contractSearchSchema.safeParse(searchParams);
    if (!parsed.success) return handleZodError(parsed.error);

    const { clientId, projectId, status, page, pageSize } = parsed.data;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ContractWhereInput = {
      client: { orgId: user.orgId },
      ...(clientId ? { clientId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(status ? { status } : {}),
    };

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          contractNumber: true,
          clientId: true,
          projectId: true,
          title: true,
          totalAmount: true,
          status: true,
          startDate: true,
          endDate: true,
          signedAt: true,
          createdAt: true,
          client: { select: { name: true } },
        },
      }),
      prisma.contract.count({ where }),
    ]);

    return NextResponse.json({ data: contracts, total, page, pageSize });
  } catch (err) {
    return handleInternalError(err);
  }
}

// POST /api/contracts — create contract with auto-generated contractNumber
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
    const parsed = contractCreateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const {
      clientId,
      projectId,
      title,
      partyA,
      partyB,
      terms,
      totalAmount,
      startDate,
      endDate,
    } = parsed.data;

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

    const contractNumber = await generateContractNumber(prisma);

    const contract = await prisma.contract.create({
      data: {
        clientId,
        projectId: projectId ?? null,
        contractNumber,
        title,
        partyA: partyA as Prisma.InputJsonValue,
        partyB: partyB as Prisma.InputJsonValue,
        terms: terms as Prisma.InputJsonValue,
        totalAmount: totalAmount ?? null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status: "DRAFT",
      },
    });

    return NextResponse.json({ data: contract }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}
