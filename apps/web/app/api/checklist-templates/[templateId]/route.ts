import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { checklistTemplateUpdateSchema } from "@/lib/validations/checklist";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ templateId: string }> };

/**
 * Verifies the template exists and belongs to the user's org.
 */
async function resolveTemplate(
  templateId: string,
  orgId: string,
): Promise<
  | { ok: true; template: NonNullable<Awaited<ReturnType<typeof prisma.checklistTemplate.findFirst>>> }
  | { ok: false; response: NextResponse }
> {
  const template = await prisma.checklistTemplate.findFirst({
    where: { id: templateId, orgId },
  });

  if (!template) {
    return { ok: false, response: notFoundResponse("ChecklistTemplate") };
  }

  return { ok: true, template };
}

/**
 * GET /api/checklist-templates/[templateId]
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { templateId } = await params;
    const result = await resolveTemplate(templateId, user.orgId);
    if (!result.ok) return result.response;

    return NextResponse.json({ data: result.template });
  } catch (error) {
    return handleInternalError(error);
  }
}

/**
 * PATCH /api/checklist-templates/[templateId]
 * Partial update.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { templateId } = await params;
    const result = await resolveTemplate(templateId, user.orgId);
    if (!result.ok) return result.response;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
        { status: 400 },
      );
    }

    const parsed = checklistTemplateUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const updated = await prisma.checklistTemplate.update({
      where: { id: templateId },
      data: parsed.data,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleInternalError(error);
  }
}

/**
 * DELETE /api/checklist-templates/[templateId]
 * Hard delete.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { templateId } = await params;
    const result = await resolveTemplate(templateId, user.orgId);
    if (!result.ok) return result.response;

    await prisma.checklistTemplate.delete({ where: { id: templateId } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleInternalError(error);
  }
}
