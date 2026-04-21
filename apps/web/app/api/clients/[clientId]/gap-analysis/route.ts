import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { analyzeGaps } from "@axle/ai";
import { z } from "zod";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ clientId: string }> };

const gapAnalysisSchema = z.object({
  programId: z.string().min(1, "programId is required"),
});

/**
 * POST /api/clients/[clientId]/gap-analysis
 * Run the gap analyzer for a client against a program.
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
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

    const { clientId } = await ctx.params;

    const body = await req.json().catch(() => ({}));
    const parsed = gapAnalysisSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const { programId } = parsed.data;

    // Boundary: client must belong to the user's org
    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
      select: { id: true },
    });
    if (!client) {
      return notFoundResponse("Client");
    }

    // Boundary: program은 조직 전용 + 크롤링된 플랫폼 프로그램(orgId=null) 모두 허용
    const program = await prisma.programInfo.findFirst({
      where: {
        id: programId,
        OR: [{ orgId: user.orgId }, { orgId: null }],
      },
      select: { id: true },
    });
    if (!program) {
      return notFoundResponse("Program");
    }

    const result = await analyzeGaps({ clientId, programId });

    return NextResponse.json({ data: result });
  } catch (err) {
    return handleInternalError(err);
  }
}
