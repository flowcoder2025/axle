import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { checklistTemplateUpdateSchema } from "@/lib/validations/checklist";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
  forbiddenResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ templateId: string }> };

/**
 * Verifies the template exists and the caller may access it.
 * - Platform templates (orgId=null) are readable by anyone, writable only by PLATFORM_ADMIN.
 * - Org templates require the caller to be in the same org.
 */
async function resolveTemplate(
  templateId: string,
  orgId: string,
): Promise<
  | {
      ok: true;
      template: NonNullable<
        Awaited<ReturnType<typeof prisma.checklistTemplate.findFirst>>
      >;
    }
  | { ok: false; response: NextResponse }
> {
  const template = await prisma.checklistTemplate.findFirst({
    where: {
      id: templateId,
      OR: [{ orgId }, { orgId: null }],
    },
  });

  if (!template) {
    return { ok: false, response: notFoundResponse("ChecklistTemplate") };
  }

  return { ok: true, template };
}

/**
 * GET /api/checklist-templates/[templateId]
 * Includes items by default. Pass ?withItems=false to skip.
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { templateId } = await params;
    const { searchParams } = new URL(req.url);
    const withItems = searchParams.get("withItems") !== "false";

    const template = await prisma.checklistTemplate.findFirst({
      where: {
        id: templateId,
        OR: [{ orgId: user.orgId }, { orgId: null }],
      },
      include: withItems
        ? { items: { orderBy: { sortOrder: "asc" } } }
        : undefined,
    });

    if (!template) {
      return notFoundResponse("ChecklistTemplate");
    }

    return NextResponse.json({ data: template });
  } catch (error) {
    return handleInternalError(error);
  }
}

/**
 * PATCH /api/checklist-templates/[templateId]
 * Partial update. Platform-wide templates require PLATFORM_ADMIN.
 * `scope` in the body can move a template between org/platform (platform admin only).
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

    const isPlatformAdmin = user.platformRole === "PLATFORM_ADMIN";
    if (result.template.orgId === null && !isPlatformAdmin) {
      return forbiddenResponse(
        "Only platform admins can modify platform-wide templates",
      );
    }

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

    const { scope, ...fields } = parsed.data;
    const data: Record<string, unknown> = { ...fields };
    if (scope !== undefined) {
      if (!isPlatformAdmin) {
        return forbiddenResponse(
          "Only platform admins can change template scope",
        );
      }
      data.orgId = scope === "platform" ? null : user.orgId;
    }

    const updated = await prisma.checklistTemplate.update({
      where: { id: templateId },
      data,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleInternalError(error);
  }
}

/**
 * DELETE /api/checklist-templates/[templateId]
 * Hard delete. Platform templates → PLATFORM_ADMIN only.
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

    const isPlatformAdmin = user.platformRole === "PLATFORM_ADMIN";
    if (result.template.orgId === null && !isPlatformAdmin) {
      return forbiddenResponse(
        "Only platform admins can delete platform-wide templates",
      );
    }

    await prisma.checklistTemplate.delete({ where: { id: templateId } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleInternalError(error);
  }
}
