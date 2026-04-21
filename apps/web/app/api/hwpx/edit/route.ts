import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { editHwpx } from "@axle/docgen";
import { uploadFile, downloadFile, BUCKETS } from "@axle/storage";
import {
  handleInternalError,
  handleZodError,
  unauthorizedResponse,
  notFoundResponse,
  forbiddenResponse,
} from "@/lib/api-helpers";
import {
  HwpxEditRequestSchema,
  type HwpxFieldMap,
} from "@/lib/validations/hwpx-template";
import {
  buildEditsFromFieldMap,
  FieldMapError,
} from "@/lib/hwpx/field-map";

/**
 * POST /api/hwpx/edit
 *
 * Fill an HWPX template stored in Supabase Storage with the supplied values,
 * upload the result back into the org's `documents` bucket, and register a
 * Document row so the file shows up in the document list.
 *
 * Body: { templateId, values, filename?, projectId?, clientId? }
 * Response: { documentId, url }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) return forbiddenResponse("No active organization");

    const body = (await req.json()) as unknown;
    const parsed = HwpxEditRequestSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { templateId, values, filename, projectId, clientId } = parsed.data;

    // Load template with org-scope enforcement: platform templates (orgId=null)
    // are visible to every org; org-scoped templates must match user.orgId.
    const template = await prisma.hwpxTemplate.findFirst({
      where: {
        id: templateId,
        OR: [{ orgId: null }, { orgId: user.orgId }],
      },
    });
    if (!template) return notFoundResponse("Template");

    // Translate fieldMap + values → HwpxEdit[]
    let edits;
    try {
      edits = buildEditsFromFieldMap(
        template.fieldMap as HwpxFieldMap,
        values
      );
    } catch (err) {
      if (err instanceof FieldMapError) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: err.message } },
          { status: 400 }
        );
      }
      throw err;
    }

    // If clientId is provided, verify org ownership
    let resolvedClientId: string | null = null;
    if (clientId) {
      const client = await prisma.client.findFirst({
        where: { id: clientId, orgId: user.orgId },
        select: { id: true },
      });
      if (!client) return notFoundResponse("Client");
      resolvedClientId = client.id;
    }

    // If projectId is provided, verify org ownership (via its client)
    let resolvedProjectId: string | null = null;
    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, client: { orgId: user.orgId } },
        select: { id: true, clientId: true },
      });
      if (!project) return notFoundResponse("Project");
      resolvedProjectId = project.id;
      // If no explicit clientId, fall back to the project's client
      if (!resolvedClientId) resolvedClientId = project.clientId;
    }

    // Document.clientId is required — if neither projectId nor clientId was
    // provided we cannot register the output. Reject with a clear message.
    if (!resolvedClientId) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "clientId or projectId is required to save output",
          },
        },
        { status: 400 }
      );
    }

    // Download template buffer from storage
    const templateBuffer = await downloadFile(
      BUCKETS.DOCUMENTS,
      template.storageKey
    );

    // Apply edits via the HWPX adapter pipeline
    const outputBuffer = await editHwpx({ templateBuffer }, edits);

    // Upload output to the org's documents bucket
    const safeName = (filename ?? `${template.name}.hwpx`).replace(
      /[^a-zA-Z0-9._가-힣-]/g,
      "_"
    );
    const uuid = randomUUID();
    const storagePath = `${user.orgId}/documents/${uuid}-${safeName}`;
    const uploadResult = await uploadFile(
      BUCKETS.DOCUMENTS,
      safeName,
      outputBuffer,
      {
        path: storagePath,
        contentType: "application/x-hwpx",
      }
    );

    // Register the generated document
    const document = await prisma.document.create({
      data: {
        clientId: resolvedClientId,
        projectId: resolvedProjectId,
        name: safeName,
        fileUrl: uploadResult.url,
        fileType: "application/x-hwpx",
        category: "OUTPUT",
        version: 1,
      },
      select: { id: true, fileUrl: true },
    });

    return NextResponse.json(
      { documentId: document.id, url: document.fileUrl },
      { status: 201 }
    );
  } catch (err) {
    return handleInternalError(err);
  }
}
