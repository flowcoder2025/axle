import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import {
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

const TOKEN_TTL_DAYS = 7;

/**
 * POST /api/upload/tokens
 * Auth required. Generates an upload token for a checklist item.
 *
 * Body: { checklistItemId: string, clientId: string }
 *
 * 1. Authenticate user
 * 2. Find the ChecklistItem (must belong to a project owned by the org)
 * 3. Ensure a Document stub exists or create one
 * 4. Generate UUID token, set expiry to now + 7 days
 * 5. Store token on Document record, link ChecklistItem → Document
 * 6. Return { data: { token, uploadUrl, expiresAt } }
 */
export async function POST(req: NextRequest) {
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

    let body: { checklistItemId?: unknown; clientId?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Request body must be JSON" } },
        { status: 400 }
      );
    }

    const { checklistItemId, clientId } = body;

    if (typeof checklistItemId !== "string" || !checklistItemId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "checklistItemId is required" } },
        { status: 400 }
      );
    }
    if (typeof clientId !== "string" || !clientId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "clientId is required" } },
        { status: 400 }
      );
    }

    // Verify client belongs to org
    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
      select: { id: true },
    });
    if (!client) {
      return notFoundResponse("Client");
    }

    // Find ChecklistItem (via project → org boundary)
    const checklistItem = await prisma.checklistItem.findFirst({
      where: {
        id: checklistItemId,
        project: { client: { orgId: user.orgId } },
      },
      select: { id: true, name: true, documentId: true, projectId: true },
    });
    if (!checklistItem) {
      return notFoundResponse("ChecklistItem");
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    let documentId: string;

    if (checklistItem.documentId) {
      // Update existing Document stub with a fresh token
      await prisma.document.update({
        where: { id: checklistItem.documentId },
        data: { uploadToken: token, tokenExpiresAt: expiresAt },
      });
      documentId = checklistItem.documentId;
    } else {
      // Create a Document stub and link it to the ChecklistItem
      const stub = await prisma.document.create({
        data: {
          clientId,
          projectId: checklistItem.projectId,
          name: checklistItem.name,
          // Placeholder values — will be replaced when the file is uploaded
          fileUrl: "",
          fileType: "",
          category: "INPUT",
          uploadToken: token,
          tokenExpiresAt: expiresAt,
        },
      });

      await prisma.checklistItem.update({
        where: { id: checklistItemId },
        data: {
          documentId: stub.id,
          status: "REQUESTED",
          requestedAt: new Date(),
        },
      });

      documentId = stub.id;
    }

    const uploadUrl = `/api/upload/${token}`;

    return NextResponse.json({
      data: { token, uploadUrl, expiresAt, documentId },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
