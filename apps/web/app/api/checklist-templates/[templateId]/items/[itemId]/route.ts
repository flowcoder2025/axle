import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { checklistTemplateItemUpdateSchema } from "@/lib/validations/checklist";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
  forbiddenResponse,
} from "@/lib/api-helpers";

type RouteContext = {
  params: Promise<{ templateId: string; itemId: string }>;
};

async function resolve(
  templateId: string,
  itemId: string,
  user: { orgId: string; platformRole: string | null },
): Promise<
  | {
      ok: true;
      item: NonNullable<
        Awaited<ReturnType<typeof prisma.checklistTemplateItem.findFirst>>
      >;
    }
  | { ok: false; response: NextResponse }
> {
  const item = await prisma.checklistTemplateItem.findFirst({
    where: {
      id: itemId,
      templateId,
      template: {
        OR: [{ orgId: user.orgId }, { orgId: null }],
      },
    },
    include: { template: { select: { orgId: true } } },
  });

  if (!item) {
    return { ok: false, response: notFoundResponse("ChecklistTemplateItem") };
  }

  if (
    item.template.orgId === null &&
    user.platformRole !== "PLATFORM_ADMIN"
  ) {
    return {
      ok: false,
      response: forbiddenResponse(
        "Only platform admins can modify platform-wide templates",
      ),
    };
  }

  return { ok: true, item };
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  try {
    const { templateId, itemId } = await params;
    const resolved = await resolve(templateId, itemId, {
      orgId: user.orgId,
      platformRole: user.platformRole ?? null,
    });
    if (!resolved.ok) return resolved.response;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
        { status: 400 },
      );
    }

    const parsed = checklistTemplateItemUpdateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const updated = await prisma.checklistTemplateItem.update({
      where: { id: itemId },
      data: parsed.data,
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleInternalError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  try {
    const { templateId, itemId } = await params;
    const resolved = await resolve(templateId, itemId, {
      orgId: user.orgId,
      platformRole: user.platformRole ?? null,
    });
    if (!resolved.ok) return resolved.response;

    await prisma.checklistTemplateItem.delete({ where: { id: itemId } });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleInternalError(err);
  }
}
