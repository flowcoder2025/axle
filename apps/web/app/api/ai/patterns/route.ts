import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { z } from "zod";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
} from "@/lib/api-helpers";

const querySchema = z.object({
  taskType: z.string().optional(),
  isFineTuned: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /api/ai/patterns — list SkillPatterns sorted by successCount desc
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const searchParams = new URL(req.url).searchParams;
    const parsed = querySchema.safeParse({
      taskType: searchParams.get("taskType") ?? undefined,
      isFineTuned: searchParams.get("isFineTuned") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });
    if (!parsed.success) return handleZodError(parsed.error);

    const { taskType, isFineTuned, page, pageSize } = parsed.data;
    const skip = (page - 1) * pageSize;

    const where = {
      ...(taskType ? { taskType } : {}),
      ...(isFineTuned !== undefined ? { isFineTuned } : {}),
    };

    const [patterns, total] = await Promise.all([
      prisma.skillPattern.findMany({
        where,
        orderBy: { successCount: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          name: true,
          taskType: true,
          successCount: true,
          lastUsedAt: true,
          isFineTuned: true,
          createdAt: true,
        },
      }),
      prisma.skillPattern.count({ where }),
    ]);

    const candidateCount = await prisma.skillPattern.count({
      where: { successCount: { gte: 10 }, isFineTuned: false },
    });

    return NextResponse.json({
      data: patterns,
      total,
      page,
      pageSize,
      candidateCount,
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
