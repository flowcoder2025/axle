import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { z } from "zod";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
} from "@/lib/api-helpers";
import { executeHandoff } from "@/lib/services/project-handoff";

type RouteContext = { params: Promise<{ projectId: string }> };

const handoffBodySchema = z.object({
  newAssigneeId: z.string().min(1, "newAssigneeId is required"),
  reason: z.string().max(1000).optional(),
});

/**
 * POST /api/projects/[projectId]/handoff
 *
 * Reassigns the project to a new member of the organization.
 * Creates a HANDOFF notification and sends a handoff email.
 *
 * Body: { newAssigneeId: string, reason?: string }
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { projectId } = await params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
        { status: 400 },
      );
    }

    const parsed = handoffBodySchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const result = await executeHandoff({
      projectId,
      newAssigneeId: parsed.data.newAssigneeId,
      reason: parsed.data.reason,
      initiatorId: user.id,
      orgId: user.orgId,
    });

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "PROJECT_NOT_FOUND") {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Project not found" } },
          { status: 404 },
        );
      }
      if (err.message === "ASSIGNEE_NOT_FOUND") {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "New assignee not found in this organization" } },
          { status: 404 },
        );
      }
    }
    return handleInternalError(err);
  }
}
