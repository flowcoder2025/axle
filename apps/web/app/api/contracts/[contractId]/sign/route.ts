import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { contractSignSchema } from "@/lib/validations/contract";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

interface RouteContext {
  params: Promise<{ contractId: string }>;
}

// POST /api/contracts/[contractId]/sign
// Accept signature data URL, update status SENT→SIGNED, store signedAt
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
      select: { id: true, status: true, contractNumber: true },
    });
    if (!contract) return notFoundResponse("Contract");

    if (contract.status !== "SENT") {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Contract must be in SENT status to sign",
          },
        },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = contractSignSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    // signatureDataUrl is a base64 data URL (e.g., data:image/png;base64,...)
    // Store it in the documentId field as a reference marker for now.
    // In a full implementation this would be stored in object storage.
    const { signatureDataUrl } = parsed.data;

    // Validate it is a data URL
    if (!signatureDataUrl.startsWith("data:")) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "signatureDataUrl must be a valid data URL",
          },
        },
        { status: 400 }
      );
    }

    const updated = await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
        // Store a marker indicating signature was provided
        documentId: `sig:${contractId}`,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleInternalError(err);
  }
}
