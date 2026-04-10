import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import {
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";
import { triggerDocumentOcr } from "@/lib/services/document-ocr";

type RouteContext = { params: Promise<{ documentId: string }> };

/**
 * POST /api/documents/[documentId]/ocr
 * Manually trigger OCR processing for a document.
 * Returns current ocrStatus and ocrResult after triggering.
 */
export async function POST(_req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse();
    }
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const { documentId } = await ctx.params;

    // Verify the document exists and belongs to the user's org
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        client: { orgId: user.orgId },
      },
      select: { id: true, fileType: true, ocrStatus: true, ocrResult: true },
    });

    if (!document) {
      return notFoundResponse("Document");
    }

    // Trigger OCR — awaited here so the response reflects the completed status.
    // For large files the client may prefer fire-and-forget; this endpoint
    // waits for completion to return the result directly.
    await triggerDocumentOcr(documentId);

    // Re-fetch updated status and result
    const updated = await prisma.document.findUnique({
      where: { id: documentId },
      select: { ocrStatus: true, ocrResult: true },
    });

    return NextResponse.json({
      data: {
        ocrStatus: updated?.ocrStatus ?? document.ocrStatus,
        ocrResult: updated?.ocrResult ?? document.ocrResult,
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
