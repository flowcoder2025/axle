import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import {
  checklistTemplateItemCreateSchema,
  checklistTemplateItemReorderSchema,
} from "@/lib/validations/checklist";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
  forbiddenResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ templateId: string }> };

/**
 * Verifies the caller may write to this template.
 * - Org templates: caller must belong to the same org.
 * - Platform templates: caller must be PLATFORM_ADMIN.
 */
async function guardTemplate(
  templateId: string,
  user: { orgId: string; platformRole: string | null },
): Promise<
  | { ok: true; template: { id: string; orgId: string | null } }
  | { ok: false; response: NextResponse }
> {
  const template = await prisma.checklistTemplate.findFirst({
    where: {
      id: templateId,
      OR: [{ orgId: user.orgId }, { orgId: null }],
    },
    select: { id: true, orgId: true },
  });

  if (!template) {
    return { ok: false, response: notFoundResponse("ChecklistTemplate") };
  }

  if (template.orgId === null && user.platformRole !== "PLATFORM_ADMIN") {
    return {
      ok: false,
      response: forbiddenResponse(
        "Only platform admins can modify platform-wide templates",
      ),
    };
  }

  return { ok: true, template };
}

/**
 * GET /api/checklist-templates/[templateId]/items
 * Lists items for a template (sorted by sortOrder asc).
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  try {
    const { templateId } = await params;
    const template = await prisma.checklistTemplate.findFirst({
      where: {
        id: templateId,
        OR: [{ orgId: user.orgId }, { orgId: null }],
      },
      select: { id: true },
    });
    if (!template) return notFoundResponse("ChecklistTemplate");

    const items = await prisma.checklistTemplateItem.findMany({
      where: { templateId },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ data: items });
  } catch (err) {
    return handleInternalError(err);
  }
}

/**
 * POST /api/checklist-templates/[templateId]/items
 * Create a new template item.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  try {
    const { templateId } = await params;
    const guard = await guardTemplate(templateId, {
      orgId: user.orgId,
      platformRole: user.platformRole ?? null,
    });
    if (!guard.ok) return guard.response;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
        { status: 400 },
      );
    }

    const parsed = checklistTemplateItemCreateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const nextOrder =
      parsed.data.sortOrder > 0
        ? parsed.data.sortOrder
        : (await prisma.checklistTemplateItem.count({ where: { templateId } })) +
          1;

    const item = await prisma.checklistTemplateItem.create({
      data: {
        ...parsed.data,
        sortOrder: nextOrder,
        templateId,
      },
    });

    return NextResponse.json({ data: item }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}

/**
 * PATCH /api/checklist-templates/[templateId]/items
 * Bulk reorder — accepts { items: [{ id, sortOrder }] }.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  try {
    const { templateId } = await params;
    const guard = await guardTemplate(templateId, {
      orgId: user.orgId,
      platformRole: user.platformRole ?? null,
    });
    if (!guard.ok) return guard.response;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
        { status: 400 },
      );
    }

    const parsed = checklistTemplateItemReorderSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const ids = parsed.data.items.map((i) => i.id);
    const owned = await prisma.checklistTemplateItem.findMany({
      where: { id: { in: ids }, templateId },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Some items do not belong to this template",
          },
        },
        { status: 400 },
      );
    }

    await prisma.$transaction(
      parsed.data.items.map((i) =>
        prisma.checklistTemplateItem.update({
          where: { id: i.id },
          data: { sortOrder: i.sortOrder },
        }),
      ),
    );

    const items = await prisma.checklistTemplateItem.findMany({
      where: { templateId },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ data: items });
  } catch (err) {
    return handleInternalError(err);
  }
}
