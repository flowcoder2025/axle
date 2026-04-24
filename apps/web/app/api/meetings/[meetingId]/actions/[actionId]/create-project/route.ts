import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { handleInternalError, unauthorizedResponse, notFoundResponse } from "@/lib/api-helpers";
import { applyChecklistTemplates } from "@/lib/services/checklist-template-apply";
import { z } from "zod";

type RouteContext = { params: Promise<{ meetingId: string; actionId: string }> };

const projectTypeSchema = z.enum([
  "BUSINESS_PLAN",
  "VENTURE_CERT",
  "SOBOOJANG_CERT",
  "RESEARCH_INSTITUTE",
  "PATENT",
  "FINANCIAL_ANALYSIS",
  "RESEARCH_TASK",
  "BUNDLE",
]);

const createProjectFromActionSchema = z.object({
  projectType: projectTypeSchema,
  title: z.string().min(1).optional(),
  clientId: z.string().min(1, "clientId is required"),
});

// POST /api/meetings/[meetingId]/actions/[actionId]/create-project
// Creates a Project from an ActionItem, auto-applies checklist templates, and links it back.
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const { meetingId, actionId } = await ctx.params;

    // Verify ActionItem exists and belongs to user's org via meeting → client → orgId
    const actionItem = await prisma.actionItem.findFirst({
      where: {
        id: actionId,
        meetingId,
        meeting: { client: { orgId: user.orgId } },
      },
      select: { id: true, description: true },
    });
    if (!actionItem) return notFoundResponse("ActionItem");

    const body = await req.json();
    const parsed = createProjectFromActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues
              .map((e) => `${e.path.join(".")}: ${e.message}`)
              .join("; "),
          },
        },
        { status: 400 }
      );
    }

    const { projectType, title, clientId } = parsed.data;

    // Verify client belongs to org
    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    const projectTitle = title ?? actionItem.description;

    // Create project and auto-apply checklist templates in a transaction
    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          clientId,
          type: projectType,
          title: projectTitle,
        },
      });

      // Auto-apply checklist templates (org-specific + platform-wide).
      // user.orgId is guaranteed non-null by the guard at the top of POST.
      const applied = await applyChecklistTemplates(tx, {
        projectId: created.id,
        orgId: user.orgId!,
        projectType: created.type,
      });

      // Link: update ActionItem.linkedChecklistId with the first checklist
      // item id when items were created. Stored as projectId reference since
      // linkedChecklistId points to a checklist item, not a project.
      let linkedChecklistId: string | null = null;
      if (applied.itemsCreated > 0) {
        const firstItem = await tx.checklistItem.findFirst({
          where: { projectId: created.id },
          orderBy: { id: "asc" },
          select: { id: true },
        });
        linkedChecklistId = firstItem?.id ?? null;
      }

      await tx.actionItem.update({
        where: { id: actionId },
        data: {
          ...(linkedChecklistId ? { linkedChecklistId } : {}),
        },
      });

      return created;
    });

    return NextResponse.json({ data: project }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}
