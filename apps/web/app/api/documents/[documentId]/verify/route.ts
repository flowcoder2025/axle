import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { evaluate } from "@axle/ai";
import { Prisma } from "@prisma/client";
import {
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";
import { getSignedUrl, BUCKETS } from "@axle/storage";
import { extractStoragePath } from "@/lib/utils/storage";

type RouteContext = { params: Promise<{ documentId: string }> };

/**
 * Extract plain text from a document's ocrResult JSON, or fetch the raw file
 * as a fallback for text-like formats (text/plain, text/markdown).
 */
async function resolveDocumentText(document: {
  fileUrl: string;
  fileType: string;
  ocrResult: Prisma.JsonValue | null;
}): Promise<string> {
  // Prefer OCR-extracted text
  if (
    document.ocrResult &&
    typeof document.ocrResult === "object" &&
    !Array.isArray(document.ocrResult)
  ) {
    const obj = document.ocrResult as Record<string, unknown>;
    if (typeof obj["text"] === "string" && obj["text"].length > 0) {
      return obj["text"];
    }
    if (typeof obj["rawText"] === "string" && obj["rawText"].length > 0) {
      return obj["rawText"];
    }
  }

  // Fallback: download raw file for text-based formats
  const textLikeTypes = new Set([
    "text/plain",
    "text/markdown",
    "text/html",
  ]);
  if (textLikeTypes.has(document.fileType)) {
    const storagePath = extractStoragePath(document.fileUrl);
    const { url } = await getSignedUrl(BUCKETS.DOCUMENTS, storagePath);
    const res = await fetch(url);
    if (res.ok) {
      return await res.text();
    }
  }

  return "";
}

/**
 * POST /api/documents/[documentId]/verify
 * Run the evaluation engine against the document's text and persist the result.
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

    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        client: { orgId: user.orgId },
      },
      select: {
        id: true,
        fileUrl: true,
        fileType: true,
        ocrResult: true,
        projectId: true,
        project: { select: { id: true } },
      },
    });

    if (!document) {
      return notFoundResponse("Document");
    }

    const documentContent = await resolveDocumentText({
      fileUrl: document.fileUrl,
      fileType: document.fileType,
      ocrResult: document.ocrResult,
    });

    if (!documentContent || documentContent.trim().length < 10) {
      return NextResponse.json(
        {
          error: {
            code: "NO_CONTENT",
            message:
              "평가할 문서 텍스트가 없습니다. OCR을 먼저 실행하거나 텍스트 기반 문서를 업로드하세요.",
          },
        },
        { status: 422 }
      );
    }

    const result = await evaluate({ documentContent });

    const now = new Date();
    await prisma.document.update({
      where: { id: documentId },
      data: {
        verifyResult: result as unknown as Prisma.InputJsonValue,
        verifiedAt: now,
      },
    });

    return NextResponse.json({
      data: {
        score: result.totalScore,
        grade: result.grade,
        items: result.criteria,
        suggestions: result.improvements,
        strengths: result.strengths,
        weaknesses: result.weaknesses,
        verifiedAt: now.toISOString(),
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}

/**
 * GET /api/documents/[documentId]/verify
 * Return the previously persisted evaluation, if any.
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
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

    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        client: { orgId: user.orgId },
      },
      select: { verifyResult: true, verifiedAt: true },
    });

    if (!document) {
      return notFoundResponse("Document");
    }

    if (!document.verifyResult) {
      return NextResponse.json({ data: null });
    }

    const stored = document.verifyResult as unknown as {
      criteria: unknown[];
      totalScore: number;
      grade: string;
      strengths: string[];
      weaknesses: string[];
      improvements: string[];
    };

    return NextResponse.json({
      data: {
        score: stored.totalScore,
        grade: stored.grade,
        items: stored.criteria,
        suggestions: stored.improvements,
        strengths: stored.strengths,
        weaknesses: stored.weaknesses,
        verifiedAt: document.verifiedAt?.toISOString() ?? null,
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
