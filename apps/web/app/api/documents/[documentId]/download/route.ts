import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { getSignedUrl, BUCKETS } from "@axle/storage";
import {
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
  const marker = `/object/public/${BUCKETS.DOCUMENTS}/`;
  const idx = fileUrl.indexOf(marker);
  if (idx !== -1) {
    return fileUrl.slice(idx + marker.length);
  }
  return fileUrl;
}

// GET /api/documents/[documentId]/download
// Returns JSON with a signed URL valid for 1 hour.
// Add ?redirect=true to issue a 302 redirect directly to the signed URL.
export async function GET(req: NextRequest, ctx: RouteContext) {
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
      select: { id: true, name: true, fileUrl: true, fileType: true },
    });

    if (!document) {
      return notFoundResponse("Document");
    }

    const storagePath = extractStoragePath(document.fileUrl);
    const { url, expiresAt } = await getSignedUrl(BUCKETS.DOCUMENTS, storagePath);

    const shouldRedirect =
      new URL(req.url).searchParams.get("redirect") === "true";

    if (shouldRedirect) {
      return NextResponse.redirect(url, { status: 302 });
    }

    return NextResponse.json({
      data: {
        url,
        expiresAt,
        name: document.name,
        fileType: document.fileType,
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
