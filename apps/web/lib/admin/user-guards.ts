import { prisma } from "@axle/db";

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Prevent admins from demoting themselves.
 * Throws ForbiddenError if currentUserId === targetUserId.
 */
export function guardSelfDemotion(currentUserId: string, targetUserId: string): void {
  if (currentUserId === targetUserId) {
    throw new ForbiddenError("자기 자신의 역할은 변경할 수 없습니다");
  }
}

/**
 * Prevent demoting the last PLATFORM_ADMIN.
 * Only checks when the change is from PLATFORM_ADMIN to USER.
 * Throws ForbiddenError if this would leave 0 admins.
 */
export async function guardLastAdminDemotion(
  targetUserId: string,
  newRole: "USER" | "PLATFORM_ADMIN",
): Promise<void> {
  if (newRole === "PLATFORM_ADMIN") return;

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { platformRole: true },
  });
  if (target?.platformRole !== "PLATFORM_ADMIN") return;

  const adminCount = await prisma.user.count({
    where: { platformRole: "PLATFORM_ADMIN" },
  });
  if (adminCount <= 1) {
    throw new ForbiddenError("마지막 플랫폼 관리자는 강등할 수 없습니다");
  }
}

/**
 * Prevent deactivating yourself.
 */
export function guardSelfDeactivation(
  currentUserId: string,
  targetUserId: string,
  newIsActive: boolean,
): void {
  if (!newIsActive && currentUserId === targetUserId) {
    throw new ForbiddenError("자기 자신을 비활성화할 수 없습니다");
  }
}
