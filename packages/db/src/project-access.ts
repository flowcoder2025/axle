import { prisma } from "./client.js";

type ProjectRole = "LEAD" | "MEMBER" | "VIEWER";

const ROLE_LEVEL: Record<ProjectRole, number> = {
  LEAD: 3,
  MEMBER: 2,
  VIEWER: 1,
};

/**
 * Check whether a user has at least `requiredRole` on a project.
 * Uses ProjectMember table. Org-level admins/owners bypass this — callers should check org access first.
 */
export async function checkProjectAccess(
  userId: string,
  projectId: string,
  requiredRole: ProjectRole,
): Promise<boolean> {
  try {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { role: true },
    });
    if (!member) return false;
    return ROLE_LEVEL[member.role as ProjectRole] >= ROLE_LEVEL[requiredRole];
  } catch {
    return false;
  }
}
