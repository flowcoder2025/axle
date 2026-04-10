import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { checklistTemplateCreateSchema } from "@/lib/validations/checklist";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
} from "@/lib/api-helpers";

/**
 * GET /api/checklist-templates
 * Returns all checklist templates for the user's org.
 * Query params: ?projectType=<ProjectType>
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { searchParams } = new URL(req.url);
    const projectTypeParam = searchParams.get("projectType");
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number(searchParams.get("pageSize") ?? "20") || 20),
    );

    const where: Record<string, unknown> = { orgId: user.orgId };
    if (projectTypeParam) {
      where.projectType = projectTypeParam;
    }

    const [data, total] = await Promise.all([
      prisma.checklistTemplate.findMany({
        where,
        orderBy: [{ projectType: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
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
 * Creates a new checklist template for the user's org.
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

    const template = await prisma.checklistTemplate.create({
      data: {
        ...parsed.data,
        orgId: user.orgId,
      },
    });

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (error) {
    return handleInternalError(error);
  }
}
