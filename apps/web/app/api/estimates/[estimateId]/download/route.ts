import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { generateEstimateDocx } from "@axle/docgen";
import {
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

interface RouteContext {
  params: Promise<{ estimateId: string }>;
}

// GET /api/estimates/[estimateId]/download
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

    const { estimateId } = await params;
    const estimate = await prisma.estimate.findFirst({
      where: { id: estimateId, client: { orgId: user.orgId } },
      include: { client: { select: { name: true } } },
    });
    if (!estimate) return notFoundResponse("Estimate");

    const items = Array.isArray(estimate.items)
      ? (estimate.items as Array<{
          name: string;
          quantity: number;
          unitPrice: number;
          amount: number;
        }>)
      : [];

    const docxBuffer = await generateEstimateDocx({
      estimateNumber: estimate.estimateNumber,
      clientName: estimate.client.name,
      items,
      totalAmount: Number(estimate.totalAmount),
      taxAmount: estimate.taxAmount ? Number(estimate.taxAmount) : undefined,
      validUntil: estimate.validUntil?.toISOString(),
      issuerName: user.name ?? "담당자",
      issuerCompany: "AXLE",
    });

    const filename = `${estimate.estimateNumber}.docx`;

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
