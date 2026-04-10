import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { Prisma } from "@prisma/client";
import {
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";
import { generateContractNumber } from "@/lib/utils/number-generator";

interface RouteContext {
  params: Promise<{ estimateId: string }>;
}

// POST /api/estimates/[estimateId]/convert
// Convert an ACCEPTED estimate into a Contract (and optionally a Project)
export async function POST(req: NextRequest, { params }: RouteContext) {
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
      include: {
        client: {
          select: {
            id: true,
            name: true,
            businessNumber: true,
            ceoName: true,
            address: true,
          },
        },
      },
    });
    if (!estimate) return notFoundResponse("Estimate");

    if (estimate.status !== "ACCEPTED") {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Estimate must be in ACCEPTED status to convert to contract",
          },
        },
        { status: 400 }
      );
    }

    // Parse body for optional overrides
    let body: { contractTitle?: string; createProject?: boolean; projectTitle?: string } = {};
    try {
      body = await req.json();
    } catch {
      // body is optional
    }

    const contractNumber = await generateContractNumber(prisma);

    // Map estimate items to contract terms
    const items = Array.isArray(estimate.items)
      ? (estimate.items as Array<{
          name: string;
          quantity: number;
          unitPrice: number;
          amount: number;
        }>)
      : [];

    const terms: Array<{ title: string; content: string; order: number }> =
      items.map((item, idx) => ({
        title: item.name,
        content: `수량: ${item.quantity}, 단가: ${item.unitPrice.toLocaleString()}원, 금액: ${item.amount.toLocaleString()}원`,
        order: idx + 1,
      }));

    // Default party info
    const partyA: Prisma.InputJsonValue = {
      name: "AXLE",
      representative: user.name ?? "담당자",
      businessNumber: "",
      address: "",
    };

    const partyB: Prisma.InputJsonValue = {
      name: estimate.client.name,
      representative: estimate.client.ceoName ?? "대표",
      businessNumber: estimate.client.businessNumber ?? "",
      address: estimate.client.address ?? "",
    };

    const contract = await prisma.$transaction(async (tx) => {
      const created = await tx.contract.create({
        data: {
          clientId: estimate.clientId,
          projectId: estimate.projectId ?? null,
          contractNumber,
          title: body.contractTitle ?? `${estimate.client.name} 계약서 (${estimate.estimateNumber} 전환)`,
          partyA,
          partyB,
          terms: terms as Prisma.InputJsonValue,
          totalAmount: estimate.totalAmount,
          status: "DRAFT",
        },
      });

      return created;
    });

    return NextResponse.json({ data: contract }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}
