import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import {
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ documentId: string }> };

/**
 * Walk the parentDocId chain upward to find the root document ID.
 * Returns the root document's id.
 */
async function findRootDocumentId(documentId: string): Promise<string> {
  let currentId = documentId;
  const visited = new Set<string>();

  while (true) {
    if (visited.has(currentId)) {
      // Cycle guard — should not happen with correct data, but be safe
      break;
    }
    visited.add(currentId);

    const doc = await prisma.document.findUnique({
      where: { id: currentId },
      select: { id: true, parentDocId: true },
    });

    if (!doc || !doc.parentDocId) {
      return currentId;
    }

    currentId = doc.parentDocId;
  }

  return currentId;
}

/**
 * GET /api/documents/[documentId]/versions
 * Returns all versions in the version chain for the given document,
 * ordered by version number ascending.
 *
 * The endpoint follows parentDocId links to find the root document,
 * then returns all documents that share the same root (by finding all
 * documents whose parentDocId chain leads to that root).
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

    // Verify the document exists and belongs to the user's org
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        client: { orgId: user.orgId },
      },
      select: { id: true },
    });

    if (!document) {
      return notFoundResponse("Document");
    }

    // Find root of the version chain
    const rootId = await findRootDocumentId(documentId);

    // Collect all versions: root + all documents that have parentDocId pointing
    // somewhere in the chain. We do a breadth-first traversal from root downward.
    const allVersions: {
      id: string;
      name: string;
      fileUrl: string;
      fileType: string;
      category: string;
      ocrStatus: string;
      version: number;
      parentDocId: string | null;
      createdAt: Date;
    }[] = [];

    const queue: string[] = [rootId];
    const seen = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (seen.has(currentId)) continue;
      seen.add(currentId);

      const current = await prisma.document.findUnique({
        where: { id: currentId },
        select: {
          id: true,
          name: true,
          fileUrl: true,
          fileType: true,
          category: true,
          ocrStatus: true,
          version: true,
          parentDocId: true,
          createdAt: true,
        },
      });

      if (!current) continue;
      allVersions.push(current);

      // Find children (documents whose parentDocId is this document)
      const children = await prisma.document.findMany({
        where: { parentDocId: currentId },
        select: { id: true },
      });

      for (const child of children) {
        queue.push(child.id);
      }
    }

    // Sort by version ascending
    allVersions.sort((a, b) => a.version - b.version);

    return NextResponse.json({ data: allVersions, total: allVersions.length });
  } catch (err) {
    return handleInternalError(err);
  }
}
