import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { generateContractDocx } from "@axle/docgen";
import {
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";
import type { ContractParty, ContractTerm } from "@axle/docgen";

interface RouteContext {
  params: Promise<{ contractId: string }>;
}

// GET /api/contracts/[contractId]/download
// Generate DOCX and return as file download
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
      include: { client: { select: { name: true } } },
    });
    if (!contract) return notFoundResponse("Contract");

    const partyA = contract.partyA as unknown as ContractParty;
    const partyB = contract.partyB as unknown as ContractParty;
    const terms = (contract.terms as unknown as ContractTerm[]) ?? [];

    const docxBuffer = await generateContractDocx({
      contractNumber: contract.contractNumber,
      title: contract.title,
      partyA,
      partyB,
      terms,
      totalAmount: contract.totalAmount ? Number(contract.totalAmount) : undefined,
      startDate: contract.startDate?.toISOString(),
      endDate: contract.endDate?.toISOString(),
    });

    const filename = `${contract.contractNumber}.docx`;

    return new NextResponse(new Uint8Array(docxBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(docxBuffer.byteLength),
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
