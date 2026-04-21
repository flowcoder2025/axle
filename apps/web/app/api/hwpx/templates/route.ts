import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@axle/db";
import { getCurrentUser, requirePlatformAdmin } from "@axle/auth";
import { uploadFile, BUCKETS, StorageValidationError } from "@axle/storage";
import {
  handleInternalError,
  handleZodError,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/api-helpers";
import { HwpxTemplateMetadataSchema } from "@/lib/validations/hwpx-template";

/**
 * GET /api/hwpx/templates
 *
 * List HWPX templates visible to the caller's org. Platform templates
 * (orgId=null) are always included. Filters: ?category=VENTURE, ?search=...
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) return forbiddenResponse("No active organization");

    const sp = new URL(req.url).searchParams;
    const category = sp.get("category");
    const search = sp.get("search");

    const templates = await prisma.hwpxTemplate.findMany({
      where: {
        OR: [{ orgId: null }, { orgId: user.orgId }],
        ...(category
          ? { category: category as "VENTURE" | "SOBOOJANG" | "KOITA" | "OTHER" }
          : {}),
        ...(search
          ? { name: { contains: search, mode: "insensitive" as const } }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        orgId: true,
        name: true,
        description: true,
        category: true,
        version: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ data: templates });
  } catch (err) {
    return handleInternalError(err);
  }
}

/**
 * POST /api/hwpx/templates — Platform admin only.
 *
 * Multipart form-data:
 *   - file:     The HWPX template file
 *   - metadata: JSON string matching HwpxTemplateMetadataSchema
 */
export async function POST(req: NextRequest) {
  try {
    let admin;
    try {
      admin = await requirePlatformAdmin();
    } catch {
      return forbiddenResponse("Platform admin required");
    }

    const formData = await req.formData();
    const fileEntry = formData.get("file");
    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "file: HWPX file is required",
          },
        },
        { status: 400 }
      );
    }

    const metadataRaw = formData.get("metadata");
    if (typeof metadataRaw !== "string") {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "metadata: JSON string is required",
          },
        },
        { status: 400 }
      );
    }

    let metadataJson: unknown;
    try {
      metadataJson = JSON.parse(metadataRaw);
    } catch {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "metadata: invalid JSON",
          },
        },
        { status: 400 }
      );
    }

    const parsed = HwpxTemplateMetadataSchema.safeParse(metadataJson);
    if (!parsed.success) return handleZodError(parsed.error);

    const { name, description, category, fieldMap, orgId } = parsed.data;

    // Upload template to storage under a stable path
    const uuid = randomUUID();
    const safeName = fileEntry.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = orgId
      ? `${orgId}/hwpx-templates/${uuid}-${safeName}`
      : `platform/hwpx-templates/${uuid}-${safeName}`;

    const arrayBuffer = await fileEntry.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    try {
      await uploadFile(BUCKETS.DOCUMENTS, safeName, buffer, {
        path: storagePath,
        contentType: fileEntry.type || "application/x-hwpx",
      });
    } catch (err) {
      if (err instanceof StorageValidationError) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: err.message } },
          { status: 400 }
        );
      }
      throw err;
    }

    const template = await prisma.hwpxTemplate.create({
      data: {
        orgId: orgId ?? null,
        name,
        description: description ?? null,
        category,
        storageKey: storagePath,
        fieldMap,
        createdById: admin.id,
      },
    });

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}
