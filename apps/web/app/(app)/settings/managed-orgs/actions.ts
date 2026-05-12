"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { z } from "zod";
import {
  requireOrgAdmin,
  grantTenantScope,
  checkTenantScope,
} from "@axle/auth";
import { prisma } from "@axle/db";
import { ACTIVE_TENANT_COOKIE } from "@/src/lib/tenant-context";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const CreateManagedOrgSchema = z.object({
  name: z.string().min(1, "이름은 필수입니다").max(120),
  bizRegNumber: z
    .string()
    .max(20)
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : null)),
});

const UpdateInstalledPacksSchema = z.object({
  installedPacks: z.array(z.enum(["A", "B", "D", "E", "F", "G"])),
});

const StatusSchema = z.enum(["ACTIVE", "PAUSED", "TERMINATED"]);

/**
 * Create a new managed org for the caller's org. Caps at the subscription's
 * `maxManaged` value; refuses when the subscription is disabled.
 */
export async function createManagedOrgAction(input: {
  name: string;
  bizRegNumber?: string;
}): Promise<ActionResult<{ id: string }>> {
  let user;
  try {
    user = await requireOrgAdmin();
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { ok: false, error: "권한이 없습니다" };
  }

  const parsed = CreateManagedOrgSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "잘못된 입력" };
  }

  const subscription = await prisma.orgMultiOrgSubscription.findUnique({
    where: { orgId: user.orgId },
  });
  if (!subscription?.enabled) {
    return { ok: false, error: "Multi-org 구독이 활성화되지 않았습니다" };
  }
  const existing = await prisma.managedOrg.count({
    where: { ownerOrgId: user.orgId, status: { not: "TERMINATED" } },
  });
  if (subscription.maxManaged > 0 && existing >= subscription.maxManaged) {
    return {
      ok: false,
      error: `관리 조직 수가 한도(${subscription.maxManaged})에 도달했습니다`,
    };
  }

  const created = await prisma.managedOrg.create({
    data: {
      ownerOrgId: user.orgId,
      name: parsed.data.name,
      bizRegNumber: parsed.data.bizRegNumber ?? undefined,
    },
    select: { id: true },
  });

  // Owner-admins always gain access to every managed org they create.
  await grantTenantScope(user.id, created.id);

  revalidatePath("/settings/managed-orgs");
  return { ok: true, data: { id: created.id } };
}

export async function updateManagedOrgPacksAction(
  managedOrgId: string,
  input: { installedPacks: Array<"A" | "B" | "D" | "E" | "F" | "G"> },
): Promise<ActionResult> {
  let user;
  try {
    user = await requireOrgAdmin();
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { ok: false, error: "권한이 없습니다" };
  }

  const parsed = UpdateInstalledPacksSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "잘못된 입력" };
  }

  const target = await prisma.managedOrg.findFirst({
    where: { id: managedOrgId, ownerOrgId: user.orgId },
  });
  if (!target) return { ok: false, error: "관리 조직을 찾을 수 없습니다" };

  await prisma.managedOrg.update({
    where: { id: managedOrgId },
    data: { installedPacks: parsed.data.installedPacks },
  });

  revalidatePath("/settings/managed-orgs");
  revalidatePath(`/settings/managed-orgs/${managedOrgId}`);
  return { ok: true };
}

export async function setManagedOrgStatusAction(
  managedOrgId: string,
  status: "ACTIVE" | "PAUSED" | "TERMINATED",
): Promise<ActionResult> {
  let user;
  try {
    user = await requireOrgAdmin();
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { ok: false, error: "권한이 없습니다" };
  }

  const parsed = StatusSchema.safeParse(status);
  if (!parsed.success) {
    return { ok: false, error: "잘못된 상태값" };
  }

  const target = await prisma.managedOrg.findFirst({
    where: { id: managedOrgId, ownerOrgId: user.orgId },
  });
  if (!target) return { ok: false, error: "관리 조직을 찾을 수 없습니다" };

  await prisma.managedOrg.update({
    where: { id: managedOrgId },
    data: { status: parsed.data },
  });

  revalidatePath("/settings/managed-orgs");
  revalidatePath(`/settings/managed-orgs/${managedOrgId}`);
  return { ok: true };
}

const SetActiveTenantSchema = z.string().max(50);

/**
 * Switch the user's active tenant. Empty string clears the cookie and
 * reverts to the owner org. Validates that the user holds a tenant scope
 * before honouring the switch.
 */
export async function setActiveTenantAction(
  rawTenantId: string,
): Promise<ActionResult> {
  let user;
  try {
    user = await requireOrgAdmin();
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { ok: false, error: "권한이 없습니다" };
  }

  const parsed = SetActiveTenantSchema.safeParse(rawTenantId);
  if (!parsed.success) return { ok: false, error: "잘못된 tenant id" };

  const cookieStore = await cookies();

  if (parsed.data === "" || parsed.data === user.orgId) {
    cookieStore.delete(ACTIVE_TENANT_COOKIE);
    revalidatePath("/", "layout");
    return { ok: true };
  }

  // Confirm membership: the managed org belongs to this owner AND the user
  // holds a tenant scope on it.
  const managed = await prisma.managedOrg.findFirst({
    where: { id: parsed.data, ownerOrgId: user.orgId, status: "ACTIVE" },
  });
  if (!managed) return { ok: false, error: "관리 조직을 찾을 수 없습니다" };

  if (!(await checkTenantScope(user.id, managed.id))) {
    return { ok: false, error: "이 조직에 접근할 권한이 없습니다" };
  }

  cookieStore.set(ACTIVE_TENANT_COOKIE, managed.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // 30 days — long enough that consultants don't have to switch every visit.
    maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
