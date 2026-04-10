import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { checklistItemCreateSchema } from "@/lib/validations/checklist-item";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
} from "@/lib/api-helpers";
import { resolveProject } from "@/lib/utils/resolve-project";

type RouteContext = { params: Promise<{ projectId: string }> };

/**
 * GET /api/projects/[projectId]/checklist
 * Returns all checklist items for the given project, scoped to the user's org.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { projectId } = await params;
    const result = await resolveProject(projectId, user.orgId);
    if (!result.ok) return result.response;

    const items = await prisma.checklistItem.findMany({
      where: { projectId },
      orderBy: [{ isRequired: "desc" }, { status: "asc" }],
    });

    // Enrich items with linked document names via a single batched query.
    // (ChecklistItem.documentId is a bare FK with no Prisma relation defined.)
    const documentIds = items
      .map((i) => i.documentId)
      .filter((id): id is string => id !== null);

    const documents =
      documentIds.length > 0
        ? await prisma.document.findMany({
            where: { id: { in: documentIds } },
            select: { id: true, name: true, fileUrl: true },
          })
        : [];

    const docMap = new Map(documents.map((d) => [d.id, d]));

    const enriched = items.map((item) => ({
      ...item,
      document: item.documentId ? (docMap.get(item.documentId) ?? null) : null,
    }));

    return NextResponse.json({ data: enriched });
  } catch (error) {
    return handleInternalError(error);
  }
}

/**
 * POST /api/projects/[projectId]/checklist
 * Manually adds a checklist item to the given project.
 * Body: { name, description?, isRequired? }
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { projectId } = await params;
    const result = await resolveProject(projectId, user.orgId);
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

    const parsed = checklistItemCreateSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const item = await prisma.checklistItem.create({
      data: {
        ...parsed.data,
        projectId,
      },
    });

    return NextResponse.json({ data: item }, { status: 201 });
  } catch (error) {
    return handleInternalError(error);
  }
}
