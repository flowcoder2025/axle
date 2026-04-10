import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma, grant } from "@axle/db";
import { projectMemberAddSchema } from "@/lib/validations/project-member";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
} from "@/lib/api-helpers";
import { resolveProject } from "@/lib/utils/resolve-project";

type RouteContext = { params: Promise<{ projectId: string }> };

/**
 * GET /api/projects/[projectId]/members
 * Lists all members for the given project, scoped to the user's org.
 * Includes user name and email via a separate users query (no Prisma relation on ProjectMember→User).
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

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      orderBy: { role: "asc" },
    });

    // Enrich with user name/email via a single batched query.
    // (ProjectMember has no Prisma relation to User defined in schema.)
    const userIds = members.map((m) => m.userId);
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
          })
        : [];

    const userMap = new Map(users.map((u) => [u.id, u]));

    const enriched = members.map((m) => ({
      ...m,
      user: userMap.get(m.userId) ?? null,
    }));

    return NextResponse.json({ data: enriched });
  } catch (error) {
    return handleInternalError(error);
  }
}

/**
 * POST /api/projects/[projectId]/members
 * Adds a user to the project with the given role.
 * Enforces uniqueness (projectId, userId) and grants a ReBAC tuple.
 * Body: { userId, role? }
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

    const parsed = projectMemberAddSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const { userId, role } = parsed.data;

    // Unique check: (projectId, userId) must not already exist.
    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: {
            code: "CONFLICT",
            message: "User is already a member of this project",
          },
        },
        { status: 409 },
      );
    }

    let member: { id: string; projectId: string; userId: string; role: string };
    try {
      member = await prisma.projectMember.create({
        data: { projectId, userId, role },
      });
    } catch {
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Failed to create project member" } },
        { status: 500 },
      );
    }

    try {
      await grant("project", projectId, role.toLowerCase(), "user", userId);
    } catch {
      // Compensating transaction: remove member record if grant fails
      await prisma.projectMember.delete({ where: { id: member.id } }).catch(() => null);
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Failed to grant project access; member not added" } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: member }, { status: 201 });
  } catch (error) {
    return handleInternalError(error);
  }
}
