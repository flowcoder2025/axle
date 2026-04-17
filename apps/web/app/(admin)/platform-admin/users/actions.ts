"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requirePlatformAdmin, invalidateUserCache } from "@axle/auth";
import { prisma } from "@axle/db";
import {
  guardSelfDemotion,
  guardLastAdminDemotion,
  guardSelfDeactivation,
  ForbiddenError,
} from "@/lib/admin/user-guards";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function changeUserRole(
  userId: string,
  newRole: "USER" | "PLATFORM_ADMIN",
): Promise<ActionResult> {
  let currentUser;
  try {
    currentUser = await requirePlatformAdmin();
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { ok: false, error: "권한이 없습니다" };
  }

  try {
    guardSelfDemotion(currentUser.id, userId);
    await guardLastAdminDemotion(userId, newRole);
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { platformRole: newRole },
  });
  invalidateUserCache(userId);

  revalidatePath("/platform-admin/users");
  revalidatePath(`/platform-admin/users/${userId}`);
  return { ok: true };
}

export async function setUserActive(
  userId: string,
  isActive: boolean,
): Promise<ActionResult> {
  let currentUser;
  try {
    currentUser = await requirePlatformAdmin();
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { ok: false, error: "권한이 없습니다" };
  }

  try {
    guardSelfDeactivation(currentUser.id, userId, isActive);
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isActive },
  });
  invalidateUserCache(userId);

  revalidatePath("/platform-admin/users");
  revalidatePath(`/platform-admin/users/${userId}`);
  return { ok: true };
}
