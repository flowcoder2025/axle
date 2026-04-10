import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { generateContractDocx } from "@axle/docgen";
import { sendEmail, contractEmail } from "@axle/email";
import {
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";
import type { ContractParty, ContractTerm } from "@axle/docgen";

interface RouteContext {
  params: Promise<{ contractId: string }>;
}

// POST /api/contracts/[contractId]/send
// Generate DOCX, send email with sign link, update status DRAFT→SENT, create EmailLog
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

    const { contractId } = await params;
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, client: { orgId: user.orgId } },
      include: { client: { select: { name: true, email: true } } },
    });
    if (!contract) return notFoundResponse("Contract");

    if (!contract.client.email) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Client has no email address",
          },
        },
        { status: 400 }
      );
    }

    const partyA = contract.partyA as unknown as ContractParty;
    const partyB = contract.partyB as unknown as ContractParty;
    const terms = (contract.terms as unknown as ContractTerm[]) ?? [];

    // Generate DOCX
    await generateContractDocx({
      contractNumber: contract.contractNumber,
      title: contract.title,
      partyA,
      partyB,
      terms,
      totalAmount: contract.totalAmount ? Number(contract.totalAmount) : undefined,
      startDate: contract.startDate?.toISOString(),
      endDate: contract.endDate?.toISOString(),
    });

    // Build sign URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://axle.app";
    const signUrl = `${baseUrl}/contracts/${contractId}/sign`;

    const emailHtml = contractEmail({
      clientName: contract.client.name,
      contractTitle: contract.title,
      signUrl,
    });

    await sendEmail({
      to: contract.client.email,
      subject: `[AXLE] 계약서 서명 요청 - ${contract.contractNumber}`,
      html: emailHtml,
    });

    // Update status and create EmailLog in transaction
    const updated = await prisma.$transaction(async (tx) => {
      const upd = await tx.contract.update({
        where: { id: contractId },
        data: { status: "SENT" },
      });

      await tx.emailLog.create({
        data: {
          clientId: contract.clientId,
          projectId: contract.projectId ?? null,
          to: contract.client.email!,
          subject: `[AXLE] 계약서 서명 요청 - ${contract.contractNumber}`,
          type: "CONTRACT",
          channel: "email",
        },
      });

      return upd;
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleInternalError(err);
  }
}
