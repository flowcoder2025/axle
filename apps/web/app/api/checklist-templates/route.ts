import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { ProjectType } from "@prisma/client";
import { checklistTemplateCreateSchema } from "@/lib/validations/checklist";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/api-helpers";

/**
 * GET /api/checklist-templates
 * Returns checklist templates visible to the caller:
 * - platform-wide templates (orgId=null) + the caller's org templates
 * Query params:
 *   ?projectType=<ProjectType>
 *   ?scope=org|platform|all (default: all)
 *   ?withItems=true          — include ChecklistTemplateItem rows
 *   ?page, ?pageSize
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { searchParams } = new URL(req.url);
    const projectTypeParam = searchParams.get("projectType");
    const scopeParam = (searchParams.get("scope") ?? "all") as
      | "org"
      | "platform"
      | "all";
    const withItems = searchParams.get("withItems") === "true";
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number(searchParams.get("pageSize") ?? "50") || 50),
    );

    let orgFilter: Record<string, unknown>;
    if (scopeParam === "org") {
      orgFilter = { orgId: user.orgId };
    } else if (scopeParam === "platform") {
      orgFilter = { orgId: null };
    } else {
      orgFilter = { OR: [{ orgId: user.orgId }, { orgId: null }] };
    }

    const where: Record<string, unknown> = { ...orgFilter };
    if (projectTypeParam) {
      if (Object.values(ProjectType).includes(projectTypeParam as ProjectType)) {
        where.projectType = projectTypeParam;
      }
    }

    const [data, total] = await Promise.all([
      prisma.checklistTemplate.findMany({
        where,
        orderBy: [{ projectType: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: withItems
          ? { items: { orderBy: { sortOrder: "asc" } } }
          : undefined,
      }),
      prisma.checklistTemplate.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    return handleInternalError(error);
  }
}

/**
 * POST /api/checklist-templates
 * Creates a new checklist template.
 * - scope="org"      → orgId = current user's org (any org member)
 * - scope="platform" → orgId = null (platform admin only)
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
        { status: 400 },
      );
    }

    const parsed = checklistTemplateCreateSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const { scope, ...fields } = parsed.data;
    const isPlatformAdmin = user.platformRole === "PLATFORM_ADMIN";

    if (scope === "platform" && !isPlatformAdmin) {
      return forbiddenResponse(
        "Only platform admins can create platform-wide templates",
      );
    }

    const template = await prisma.checklistTemplate.create({
      data: {
        ...fields,
        orgId: scope === "platform" ? null : user.orgId,
      },
    });

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (error) {
    return handleInternalError(error);
  }
}
