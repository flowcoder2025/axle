import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { projectCreateSchema, projectSearchSchema } from "@/lib/validations/project";
import { handleZodError, handleInternalError, unauthorizedResponse } from "@/lib/api-helpers";
import { Prisma } from "@prisma/client";
import { createBundleChildren } from "@/lib/services/project-bundle";

// GET /api/projects — list projects with filters and pagination
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse();
    }
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const searchParams = Object.fromEntries(new URL(req.url).searchParams);
    const parsed = projectSearchSchema.safeParse(searchParams);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const { clientId, type, status, assignedToId, page, pageSize } = parsed.data;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ProjectWhereInput = {
      client: { orgId: user.orgId },
      ...(clientId ? { clientId } : {}),
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
      ...(assignedToId ? { assignedToId } : {}),
    };

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          clientId: true,
          programId: true,
          parentId: true,
          type: true,
          title: true,
          status: true,
          priority: true,
          assignedToId: true,
          assignedToUser: { select: { id: true, name: true, email: true } },
          dueDate: true,
          submissionDate: true,
          feeType: true,
          feeAmount: true,
          successRate: true,
          isPaid: true,
          createdAt: true,
          updatedAt: true,
          client: { select: { name: true } },
        },
      }),
      prisma.project.count({ where }),
    ]);

    return NextResponse.json({ data: projects, total, page, pageSize });
  } catch (err) {
    return handleInternalError(err);
  }
}

// POST /api/projects — create project and auto-apply checklist templates
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse();
    }
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const orgId = user.orgId;
    const body = await req.json();
    const parsed = projectCreateSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    // Verify client belongs to the user's org
    const client = await prisma.client.findFirst({
      where: { id: parsed.data.clientId, orgId },
      select: { id: true },
    });

    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    const { dueDate, feeAmount, successRate, metadata, childTypes, ...rest } = parsed.data;

    // Create project and auto-apply checklist templates in a transaction
    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          ...rest,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          feeAmount: feeAmount !== undefined ? feeAmount : undefined,
          successRate: successRate !== undefined ? successRate : undefined,
          metadata: metadata != null ? (metadata as Prisma.InputJsonValue) : undefined,
        },
      });

      // Auto-apply checklist templates for this project type + org
      const templates = await tx.checklistTemplate.findMany({
        where: { orgId, projectType: created.type },
        orderBy: { sortOrder: "asc" },
      });

      if (templates.length > 0) {
        await tx.checklistItem.createMany({
          data: templates.map((tpl) => ({
            projectId: created.id,
            name: tpl.name,
            description: tpl.description,
            isRequired: tpl.isRequired,
          })),
        });
      }

      // For BUNDLE projects: auto-create child projects inside the same transaction
      if (created.type === "BUNDLE") {
        await createBundleChildren(
          tx,
          created.id,
          created.title,
          created.clientId,
          orgId,
          childTypes
        );
      }

      return created;
    });

    return NextResponse.json({ data: project }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}
