import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { uploadFromFormData, BUCKETS, StorageValidationError } from "@axle/storage";
import { handleInternalError } from "@/lib/api-helpers";
import { eventBus } from "@/lib/events/event-bus";

/**
 * POST /api/upload/[token]
 * Public endpoint — no auth required. Auth is via the upload token.
 *
 * 1. Find Document by uploadToken
 * 2. Check tokenExpiresAt > now
 * 3. Upload file via @axle/storage
 * 4. Update Document record with fileUrl
 * 5. If linked to ChecklistItem, update status to UPLOADED
 * 6. Return { data: { documentId, name, fileUrl } }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // 1. Find Document by uploadToken
    const document = await prisma.document.findUnique({
      where: { uploadToken: token },
    });

    if (!document) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Invalid upload token" } },
        { status: 404 }
      );
    }

    // 2. Check token expiry
    if (!document.tokenExpiresAt || document.tokenExpiresAt < new Date()) {
      return NextResponse.json(
        { error: { code: "TOKEN_EXPIRED", message: "Upload token has expired" } },
        { status: 410 }
      );
    }

    // 3. Upload file via @axle/storage
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Request must be multipart/form-data" } },
        { status: 400 }
      );
    }

    let uploadResult;
    try {
      uploadResult = await uploadFromFormData(BUCKETS.DOCUMENTS, formData, "file");
    } catch (err) {
      if (err instanceof StorageValidationError) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: err.message } },
          { status: 400 }
        );
      }
      throw err;
    }

    const fileEntry = formData.get("file");
    const fileName = fileEntry instanceof File ? fileEntry.name : document.name;

    // 4. Update Document record with fileUrl and clear the token
    const updatedDocument = await prisma.document.update({
      where: { id: document.id },
      data: {
        fileUrl: uploadResult.url,
        fileType: uploadResult.contentType,
        name: fileName,
        uploadToken: null,
        tokenExpiresAt: null,
      },
    });

    // 5. If a ChecklistItem references this document, update status to UPLOADED
    const linkedItem = await prisma.checklistItem.findFirst({
      where: { documentId: document.id },
    });

    if (linkedItem) {
      await prisma.checklistItem.update({
        where: { id: linkedItem.id },
        data: {
          status: "UPLOADED",
          uploadedAt: new Date(),
        },
      });

      // If every REQUIRED checklist item for this project is now
      // UPLOADED/VERIFIED, the portal submission is effectively complete.
      // Emit PORTAL_COMPLETE so downstream channels can notify the
      // consultant assigned to the client.
      const remainingRequired = await prisma.checklistItem.count({
        where: {
          projectId: linkedItem.projectId,
          isRequired: true,
          status: { in: ["PENDING", "REQUESTED"] },
        },
      });

      if (remainingRequired === 0) {
        const project = await prisma.project.findUnique({
          where: { id: linkedItem.projectId },
          select: {
            id: true,
            clientId: true,
            client: { select: { assignedToId: true } },
          },
        });
        const assigneeId = project?.client?.assignedToId;
        if (project && assigneeId) {
          eventBus
            .emit("PORTAL_COMPLETE", {
              portalId: project.id,
              clientId: project.clientId,
              assigneeId,
            })
            .catch((err: unknown) => {
              console.error(
                `upload: PORTAL_COMPLETE emit failed for project ${project.id}`,
                err,
              );
            });
        }
      }
    }

    // 6. Return result
    return NextResponse.json({
      data: {
        documentId: updatedDocument.id,
        name: updatedDocument.name,
        fileUrl: updatedDocument.fileUrl,
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
