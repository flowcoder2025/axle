import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { uploadFromFormData, BUCKETS } from "@axle/storage";
import { StorageValidationError } from "@axle/storage";
import {
  documentSearchSchema,
  documentUploadSchema,
} from "@/lib/validations/document";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
} from "@/lib/api-helpers";
import { triggerDocumentOcr } from "@/lib/services/document-ocr";
import { eventBus } from "@/lib/events/event-bus";
import { Prisma } from "@prisma/client";

// GET /api/documents — list documents with filtering and pagination
export async function GET(req: NextRequest) {
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

    const searchParams = Object.fromEntries(new URL(req.url).searchParams);
    const parsed = documentSearchSchema.safeParse(searchParams);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const { clientId, projectId, category, ocrStatus, page, pageSize } =
      parsed.data;
    const skip = (page - 1) * pageSize;

    // Org boundary: only documents whose client belongs to the user's org
    const where: Prisma.DocumentWhereInput = {
      client: { orgId: user.orgId },
      ...(clientId ? { clientId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(category ? { category } : {}),
      ...(ocrStatus ? { ocrStatus } : {}),
    };

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          clientId: true,
          projectId: true,
          name: true,
          fileUrl: true,
          fileType: true,
          category: true,
          ocrStatus: true,
          expiresAt: true,
          autoRenew: true,
          version: true,
          parentDocId: true,
          createdAt: true,
        },
      }),
      prisma.document.count({ where }),
    ]);

    return NextResponse.json({ data: documents, total, page, pageSize });
  } catch (err) {
    return handleInternalError(err);
  }
}

// POST /api/documents — upload a document (multipart/form-data)
// Body fields: file (File), clientId, projectId?, category, name?, parentDocId?
// When parentDocId is provided, creates a new version (version = parent.version + 1)
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

    const formData = await req.formData();

    // Validate non-file fields
    const fields = {
      clientId: formData.get("clientId"),
      projectId: formData.get("projectId") ?? undefined,
      category: formData.get("category"),
      name: formData.get("name") ?? undefined,
      parentDocId: formData.get("parentDocId") ?? undefined,
    };
    const parsed = documentUploadSchema.safeParse(fields);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const { clientId, projectId, category, name, parentDocId } = parsed.data;

    // Org boundary: verify the client belongs to the user's org
    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    // Resolve version number: if parentDocId provided, auto-increment from parent
    let version = 1;
    if (parentDocId) {
      const parentDoc = await prisma.document.findFirst({
        where: {
          id: parentDocId,
          client: { orgId: user.orgId },
        },
        select: { id: true, version: true },
      });
      if (!parentDoc) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Parent document not found" } },
          { status: 404 }
        );
      }
      version = parentDoc.version + 1;
    }

    // Upload file to storage — path: {orgId}/documents/{uuid}-{filename}
    let uploadResult;
    try {
      const fileEntry = formData.get("file");
      if (!(fileEntry instanceof File)) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "file: File is required",
            },
          },
          { status: 400 }
        );
      }

      const uuid = randomUUID();
      const safeName = fileEntry.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${user.orgId}/documents/${uuid}-${safeName}`;

      uploadResult = await uploadFromFormData(
        BUCKETS.DOCUMENTS,
        formData,
        "file",
        { path: storagePath }
      );
    } catch (err) {
      if (err instanceof StorageValidationError) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: err.message } },
          { status: 400 }
        );
      }
      throw err;
    }

    const fileEntry = formData.get("file") as File;
    const documentName = name ?? fileEntry.name;

    const document = await prisma.document.create({
      data: {
        clientId,
        projectId: projectId ?? null,
        name: documentName,
        fileUrl: uploadResult.url,
        fileType: uploadResult.contentType,
        category,
        version,
        parentDocId: parentDocId ?? null,
      },
    });

    // Fire-and-forget: trigger OCR for eligible file types without blocking the 201 response
    void triggerDocumentOcr(document.id);

    // Fire-and-forget: emit DOC_UPLOADED event for notification dispatch
    void eventBus
      .emit("DOC_UPLOADED", {
        documentId: document.id,
        clientId: document.clientId,
        uploaderId: user.id,
      })
      .catch(console.error);

    return NextResponse.json({ data: document }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}
