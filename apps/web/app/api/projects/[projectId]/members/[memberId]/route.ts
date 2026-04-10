import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma, grant, revoke } from "@axle/db";
import { projectMemberUpdateSchema } from "@/lib/validations/project-member";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ projectId: string; memberId: string }> };

/**
 * Resolves a ProjectMember, enforcing org boundary via project.client.orgId.
 */
async function resolveMember(
  projectId: string,
  memberId: string,
  orgId: string,
): Promise<
  | {
      ok: true;
      member: { id: string; projectId: string; userId: string; role: string };
    }
  | { ok: false; response: NextResponse }
> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, client: { orgId } },
    select: { id: true },
  });

  if (!project) {
    return { ok: false, response: notFoundResponse("Project") };
  }

  const member = await prisma.projectMember.findFirst({
    where: { id: memberId, projectId },
  });

  if (!member) {
    return { ok: false, response: notFoundResponse("ProjectMember") };
  }

  return { ok: true, member };
}

/**
 * PATCH /api/projects/[projectId]/members/[memberId]
 * Changes the role of a project member.
 * Revokes the old ReBAC tuple and grants the new one atomically.
 * Body: { role }
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { projectId, memberId } = await params;
    const result = await resolveMember(projectId, memberId, user.orgId);
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

    const parsed = projectMemberUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const { role } = parsed.data;
    const oldRole = result.member.role;
    const { userId } = result.member;

    const updated = await prisma.projectMember.update({
      where: { id: memberId },
      data: { role },
    });

    // Swap ReBAC tuples only if role actually changed.
    if (role !== oldRole) {
      await revoke("project", projectId, oldRole.toLowerCase(), "user", userId);
      await grant("project", projectId, role.toLowerCase(), "user", userId);
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleInternalError(error);
  }
}

/**
 * DELETE /api/projects/[projectId]/members/[memberId]
 * Removes a member from the project and revokes the ReBAC tuple.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { projectId, memberId } = await params;
    const result = await resolveMember(projectId, memberId, user.orgId);
    if (!result.ok) return result.response;

    const { userId, role } = result.member;

    await prisma.projectMember.delete({ where: { id: memberId } });
    await revoke("project", projectId, role.toLowerCase(), "user", userId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleInternalError(error);
  }
}
