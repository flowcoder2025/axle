"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function updatePlanQuota(
  orgId: string,
  data: {
    plan?: "free" | "pro" | "enterprise";
    quotaAiJobs?: number;
    quotaMembers?: number;
  },
): Promise<ActionResult> {
  try {
    await requirePlatformAdmin();
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { ok: false, error: "권한이 없습니다" };
  }

  if (data.quotaAiJobs !== undefined && data.quotaAiJobs < 0) {
    return { ok: false, error: "AI 작업 쿼터는 0 이상이어야 합니다" };
  }
  if (data.quotaMembers !== undefined && data.quotaMembers < 1) {
    return { ok: false, error: "멤버 쿼터는 1 이상이어야 합니다" };
  }

  await prisma.organization.update({
    where: { id: orgId },
    data,
  });

  revalidatePath("/platform-admin/organizations");
  revalidatePath(`/platform-admin/organizations/${orgId}`);
  return { ok: true };
}

export async function toggleOrgSuspend(
  orgId: string,
  isSuspended: boolean,
): Promise<ActionResult> {
  try {
    await requirePlatformAdmin();
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { ok: false, error: "권한이 없습니다" };
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { isSuspended },
  });

  revalidatePath("/platform-admin/organizations");
  revalidatePath(`/platform-admin/organizations/${orgId}`);
  return { ok: true };
}
