import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import {
  InvalidTransitionError,
  markFineTuneComplete,
  promoteToLocalMlx,
} from "@axle/ai";
import {
  handleInternalError,
  handleZodError,
  unauthorizedResponse,
  notFoundResponse,
  forbiddenResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ patternId: string }> };

const bodySchema = z
  .object({
    loraAdapterUrl: z.string().url().optional(),
  })
  .strict();

/**
 * POST /api/ai/patterns/[patternId]/promote
 *
 * Platform-admin manual promotion hook. Two modes:
 *   1. FINE_TUNING → COMPLETED → PROMOTED: provide `loraAdapterUrl` in the body.
 *      Marks the fine-tune complete and immediately attempts promotion.
 *   2. COMPLETED → PROMOTED: called without body when the pattern already has
 *      a `loraAdapterUrl` stored.
 *
 * On agent-bridge failure, the pattern transitions to FAILED (handled inside
 * promoteToLocalMlx). The resulting pattern is returned so the UI can show
 * the failure reason.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    await requirePlatformAdmin();
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "FORBIDDEN") return forbiddenResponse();
    return unauthorizedResponse();
  }

  try {
    const { patternId } = await params;

    const existing = await prisma.skillPattern.findUnique({
      where: { id: patternId },
    });
    if (!existing) return notFoundResponse("SkillPattern");

    let parsedBody: z.infer<typeof bodySchema> = {};
    const raw = await req.text();
    if (raw.trim().length > 0) {
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
          { status: 400 },
        );
      }
      const parsed = bodySchema.safeParse(body);
      if (!parsed.success) return handleZodError(parsed.error);
      parsedBody = parsed.data;
    }

    if (parsedBody.loraAdapterUrl && existing.status === "FINE_TUNING") {
      const result = await markFineTuneComplete(
        patternId,
        parsedBody.loraAdapterUrl,
      );
      return NextResponse.json({ data: result });
    }

    const result = await promoteToLocalMlx(patternId);
    return NextResponse.json({ data: result });
  } catch (err) {
    if (err instanceof InvalidTransitionError) {
      return NextResponse.json(
        { error: { code: "INVALID_TRANSITION", message: err.message } },
        { status: 409 },
      );
    }
    return handleInternalError(err);
  }
}
