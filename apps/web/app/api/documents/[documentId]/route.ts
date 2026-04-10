import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { getSignedUrl, deleteFile, BUCKETS } from "@axle/storage";
import { documentUpdateSchema } from "@/lib/validations/document";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ documentId: string }> };

/**
 * Extract the storage path from a full public URL.
 * The URL format from Supabase is:
 *   https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
 */
function extractStoragePath(fileUrl: string): string {
  // Everything after "/documents/" bucket segment
  const marker = `/object/public/${BUCKETS.DOCUMENTS}/`;
  const idx = fileUrl.indexOf(marker);
  if (idx !== -1) {
    return fileUrl.slice(idx + marker.length);
  }
  // Fallback: return as-is so deleteFile will fail with a clear error
  return fileUrl;
}

// GET /api/documents/[documentId] — single document with signed download URL
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
    });

    if (!document) {
      return notFoundResponse("Document");
    }

    const storagePath = extractStoragePath(document.fileUrl);
    const { url: signedUrl, expiresAt } = await getSignedUrl(
      BUCKETS.DOCUMENTS,
      storagePath
    );

    return NextResponse.json({ data: { ...document, signedUrl, signedUrlExpiresAt: expiresAt } });
  } catch (err) {
    return handleInternalError(err);
  }
}

// PATCH /api/documents/[documentId] — update metadata (category, expiresAt, autoRenew)
export async function PATCH(req: NextRequest, ctx: RouteContext) {
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

    const existing = await prisma.document.findFirst({
      where: {
        id: documentId,
        client: { orgId: user.orgId },
      },
      select: { id: true },
    });

    if (!existing) {
      return notFoundResponse("Document");
    }

    const body = await req.json();
    const parsed = documentUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const { category, expiresAt, autoRenew } = parsed.data;

    const document = await prisma.document.update({
      where: { id: documentId },
      data: {
        ...(category !== undefined ? { category } : {}),
        ...(expiresAt !== undefined
          ? { expiresAt: expiresAt ? new Date(expiresAt) : null }
          : {}),
        ...(autoRenew !== undefined ? { autoRenew } : {}),
      },
    });

    return NextResponse.json({ data: document });
  } catch (err) {
    return handleInternalError(err);
  }
}

// DELETE /api/documents/[documentId] — delete from storage and DB
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
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
      select: { id: true, fileUrl: true },
    });

    if (!document) {
      return notFoundResponse("Document");
    }

    // Delete from storage first; if storage fails, do not delete the DB record
    const storagePath = extractStoragePath(document.fileUrl);
    await deleteFile(BUCKETS.DOCUMENTS, storagePath);

    await prisma.document.delete({ where: { id: documentId } });

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    return handleInternalError(err);
  }
}
