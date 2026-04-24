import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { projectStatusTransitionSchema } from "@/lib/validations/project";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";
import { canTransition } from "@/lib/services/project-state-machine";
import { autoCreateCertificateFromProject } from "@/lib/services/project-certificate-auto";
import { maybeCompleteBundleParent } from "@/lib/services/bundle-auto-complete";
import { eventBus } from "@/lib/events/event-bus";

type RouteContext = { params: Promise<{ projectId: string }> };

// PATCH /api/projects/[projectId]/status — transition project status
export async function PATCH(req: NextRequest, ctx: RouteContext) {
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

    const { projectId } = await ctx.params;

    const project = await prisma.project.findFirst({
      where: { id: projectId, client: { orgId: user.orgId } },
      select: { id: true, status: true, type: true, clientId: true, title: true },
    });

    if (!project) {
      return notFoundResponse("Project");
    }

    const body = await req.json();
    const parsed = projectStatusTransitionSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const { status: targetStatus } = parsed.data;

    if (!canTransition(project.status, targetStatus)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_TRANSITION",
            message: `Cannot transition from ${project.status} to ${targetStatus}`,
          },
        },
        { status: 400 }
      );
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { status: targetStatus },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    });

    // WI-325: when a project transitions into COMPLETED, auto-issue the
    // certificate it was pursuing (if any). Idempotent via
    // `findValidCertificate` inside the service. Errors are logged but do
    // not fail the status transition response.
    if (targetStatus === "COMPLETED" && project.status !== "COMPLETED") {
      const completedAt = new Date();
      const result = await autoCreateCertificateFromProject({
        id: project.id,
        type: project.type,
        clientId: project.clientId,
        title: project.title,
      }).catch((err) => {
        console.error("autoCreateCertificateFromProject failed", err);
        return {
          created: false,
          certificateId: null,
          reason: "UNSUPPORTED_TYPE" as const,
        };
      });

      void eventBus
        .emit("PROJECT_COMPLETED", {
          projectId: project.id,
          projectType: project.type,
          clientId: project.clientId,
          completedAt,
          certificateCreated: result.created,
          certificateId: result.certificateId,
        })
        .catch(console.error);

      // WI-324: if this project has a BUNDLE parent and all siblings are now
      // COMPLETED, bubble the completion up. Runs asynchronously so the status
      // PATCH response isn't blocked on parent bookkeeping.
      void maybeCompleteBundleParent(project.id).catch((err) =>
        console.error("maybeCompleteBundleParent failed", err),
      );
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleInternalError(err);
  }
}
