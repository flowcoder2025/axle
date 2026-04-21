import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser, requirePlatformAdmin } from "@axle/auth";
import { deleteFile, BUCKETS } from "@axle/storage";
import {
  handleInternalError,
  handleZodError,
  unauthorizedResponse,
  notFoundResponse,
  forbiddenResponse,
} from "@/lib/api-helpers";
import { HwpxTemplatePatchSchema } from "@/lib/validations/hwpx-template";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/hwpx/templates/[id]
 * Returns the full template including fieldMap.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) return forbiddenResponse("No active organization");

    const { id } = await params;
    const template = await prisma.hwpxTemplate.findFirst({
      where: {
        id,
        OR: [{ orgId: null }, { orgId: user.orgId }],
      },
    });

    if (!template) return notFoundResponse("Template");

    return NextResponse.json({ data: template });
  } catch (err) {
    return handleInternalError(err);
  }
}

/**
 * PATCH /api/hwpx/templates/[id] — Platform admin only.
 * Updates metadata (name/description/category/fieldMap) and bumps version.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    try {
      await requirePlatformAdmin();
    } catch {
      return forbiddenResponse("Platform admin required");
    }

    const { id } = await params;
    const existing = await prisma.hwpxTemplate.findUnique({ where: { id } });
    if (!existing) return notFoundResponse("Template");

    const body = (await req.json()) as unknown;
    const parsed = HwpxTemplatePatchSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const data = parsed.data;

    const updated = await prisma.hwpxTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.fieldMap !== undefined
          ? { fieldMap: data.fieldMap, version: { increment: 1 } }
          : {}),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleInternalError(err);
  }
}

/**
 * DELETE /api/hwpx/templates/[id] — Platform admin only.
 * Removes the DB row and tries to delete the backing storage object
 * (storage failure is logged but does not block the DB delete).
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    try {
      await requirePlatformAdmin();
    } catch {
      return forbiddenResponse("Platform admin required");
    }

    const { id } = await params;
    const existing = await prisma.hwpxTemplate.findUnique({ where: { id } });
    if (!existing) return notFoundResponse("Template");

    await prisma.hwpxTemplate.delete({ where: { id } });

    // Best-effort storage cleanup
    try {
      await deleteFile(BUCKETS.DOCUMENTS, existing.storageKey);
    } catch (err) {
      console.warn(
        `hwpxTemplate: failed to delete storage object ${existing.storageKey}`,
        err
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleInternalError(err);
  }
}
