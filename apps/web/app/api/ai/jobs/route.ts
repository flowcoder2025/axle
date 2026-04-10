import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { Prisma } from "@prisma/client";
import { resolveAiTier } from "@axle/ai";
import { aiJobCreateSchema, aiJobQuerySchema } from "@/lib/validations/ai-job";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
} from "@/lib/api-helpers";

// GET /api/ai/jobs — list AI jobs with filters and pagination
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const searchParams = Object.fromEntries(new URL(req.url).searchParams);
    const parsed = aiJobQuerySchema.safeParse(searchParams);
    if (!parsed.success) return handleZodError(parsed.error);

    const { projectId, type, status, tier, page, pageSize } = parsed.data;
    const skip = (page - 1) * pageSize;

    const where: Prisma.AiJobWhereInput = {
      // Enforce org boundary via project → client → orgId
      project: { client: { orgId: user.orgId } },
      ...(projectId ? { projectId } : {}),
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
      ...(tier ? { tier } : {}),
    };

    const [jobs, total] = await Promise.all([
      prisma.aiJob.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          projectId: true,
          type: true,
          tier: true,
          status: true,
          cost: true,
          durationMs: true,
          errorMessage: true,
          skillPatternId: true,
          createdAt: true,
        },
      }),
      prisma.aiJob.count({ where }),
    ]);

    return NextResponse.json({ data: jobs, total, page, pageSize });
  } catch (err) {
    return handleInternalError(err);
  }
}

// POST /api/ai/jobs — create a new AI job
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = aiJobCreateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { projectId, type, input, skillPatternId, tier: tierOverride } = parsed.data;

    // Verify project belongs to user's org (if projectId is provided)
    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, client: { orgId: user.orgId } },
        select: { id: true },
      });
      if (!project) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Project not found" } },
          { status: 404 }
        );
      }
    }

    const tier = tierOverride ?? resolveAiTier(type);

    const job = await prisma.aiJob.create({
      data: {
        projectId,
        type,
        tier,
        status: "QUEUED",
        input: input as Prisma.InputJsonValue,
        skillPatternId,
      },
    });

    return NextResponse.json({ data: job }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}
