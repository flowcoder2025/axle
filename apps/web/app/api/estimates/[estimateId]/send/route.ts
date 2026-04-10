import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { generateEstimateDocx } from "@axle/docgen";
import { sendEmail, estimateEmail } from "@axle/email";
import {
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

interface RouteContext {
  params: Promise<{ estimateId: string }>;
}

// POST /api/estimates/[estimateId]/send
// Generate DOCX, send email, update status DRAFT→SENT, create EmailLog
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
      include: { client: { select: { name: true, email: true } } },
    });
    if (!estimate) return notFoundResponse("Estimate");

    if (!estimate.client.email) {
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

    // Parse items from JSON
    const items = Array.isArray(estimate.items)
      ? (estimate.items as Array<{
          name: string;
          quantity: number;
          unitPrice: number;
          amount: number;
        }>)
      : [];

    // Generate DOCX
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

    // Build download URL for the email
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://axle.app";
    const downloadUrl = `${baseUrl}/api/estimates/${estimateId}/download`;

    const validUntilStr = estimate.validUntil
      ? estimate.validUntil.toLocaleDateString("ko-KR")
      : "별도 안내";

    // Send email with DOCX attachment
    const emailHtml = estimateEmail({
      clientName: estimate.client.name,
      estimateNumber: estimate.estimateNumber,
      items,
      totalAmount: Number(estimate.totalAmount),
      validUntil: validUntilStr,
      downloadUrl,
    });

    await sendEmail({
      to: estimate.client.email,
      subject: `[AXLE] 견적서 발송 - ${estimate.estimateNumber}`,
      html: emailHtml,
    });

    // Update status and sentAt in a transaction, create EmailLog
    const updated = await prisma.$transaction(async (tx) => {
      const upd = await tx.estimate.update({
        where: { id: estimateId },
        data: { status: "SENT", sentAt: new Date() },
      });

      await tx.emailLog.create({
        data: {
          clientId: estimate.clientId,
          projectId: estimate.projectId ?? null,
          to: estimate.client.email!,
          subject: `[AXLE] 견적서 발송 - ${estimate.estimateNumber}`,
          type: "ESTIMATE",
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
