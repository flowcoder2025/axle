"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import { PlanQuotaSchema, type PlanQuota } from "@/lib/admin/org-schemas";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function updatePlanQuota(
  orgId: string,
  data: PlanQuota,
): Promise<ActionResult> {
  try {
    await requirePlatformAdmin();
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { ok: false, error: "권한이 없습니다" };
  }

  const parsed = PlanQuotaSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    };
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: parsed.data,
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

  if (typeof isSuspended !== "boolean") {
    return { ok: false, error: "invalid isSuspended value" };
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { isSuspended },
  });

  revalidatePath("/platform-admin/organizations");
  revalidatePath(`/platform-admin/organizations/${orgId}`);
  return { ok: true };
}
