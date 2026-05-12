"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { z } from "zod";
import { requireOrgAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import { PACK_IDS, ALL_MODULE_IDS } from "@/src/lib/module-catalog";

export type ActionResult = { ok: true } | { ok: false; error: string };

const PackIdSchema = z.enum(PACK_IDS);
const ModuleIdSchema = z.enum(
  ALL_MODULE_IDS as unknown as readonly [string, ...string[]],
);

/**
 * Install every module of `packId` for the current org.
 *
 * Uses Prisma directly here (not `installPack` from `@axle/core-module-system`)
 * because that helper expects the in-memory registry to be populated by the
 * module bootstrap layer, which lands in WI-621 (apps/flowteams migration).
 * Until then the catalog is the source of truth and this action just records
 * the install rows. The contract surface (`OrgModuleInstall.orgId+moduleId`
 * unique) is identical.
 */
export async function installPackAction(
  rawPackId: string,
): Promise<ActionResult> {
  let user;
  try {
    user = await requireOrgAdmin();
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { ok: false, error: "권한이 없습니다" };
  }

  const parsed = PackIdSchema.safeParse(rawPackId);
  if (!parsed.success) {
    return { ok: false, error: "알 수 없는 Pack 입니다" };
  }
  const packId = parsed.data;

  const { PACK_CATALOG } = await import("@/src/lib/module-catalog");
  const pack = PACK_CATALOG.find((p) => p.id === packId)!;

  for (const mod of pack.modules) {
    await prisma.orgModuleInstall.upsert({
      where: {
        orgId_moduleId: { orgId: user.orgId, moduleId: mod.id },
      },
      update: {},
      create: { orgId: user.orgId, moduleId: mod.id },
    });
  }

  revalidatePath("/settings/modules");
  return { ok: true };
}

/**
 * Remove every module of `packId` for the current org. Modules that are still
 * referenced by other installed packs survive (we only delete modules whose
 * sole owner is `packId`).
 */
export async function uninstallPackAction(
  rawPackId: string,
): Promise<ActionResult> {
  let user;
  try {
    user = await requireOrgAdmin();
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { ok: false, error: "권한이 없습니다" };
  }

  const parsed = PackIdSchema.safeParse(rawPackId);
  if (!parsed.success) {
    return { ok: false, error: "알 수 없는 Pack 입니다" };
  }
  const packId = parsed.data;

  const { PACK_CATALOG } = await import("@/src/lib/module-catalog");
  const pack = PACK_CATALOG.find((p) => p.id === packId)!;
  const moduleIds = pack.modules.map((m) => m.id);

  await prisma.orgModuleInstall.deleteMany({
    where: { orgId: user.orgId, moduleId: { in: moduleIds } },
  });

  revalidatePath("/settings/modules");
  return { ok: true };
}

export async function installModuleAction(
  rawModuleId: string,
): Promise<ActionResult> {
  let user;
  try {
    user = await requireOrgAdmin();
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { ok: false, error: "권한이 없습니다" };
  }

  const parsed = ModuleIdSchema.safeParse(rawModuleId);
  if (!parsed.success) {
    return { ok: false, error: "알 수 없는 모듈입니다" };
  }
  const moduleId = parsed.data;

  await prisma.orgModuleInstall.upsert({
    where: { orgId_moduleId: { orgId: user.orgId, moduleId } },
    update: {},
    create: { orgId: user.orgId, moduleId },
  });

  revalidatePath("/settings/modules");
  return { ok: true };
}

export async function uninstallModuleAction(
  rawModuleId: string,
): Promise<ActionResult> {
  let user;
  try {
    user = await requireOrgAdmin();
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { ok: false, error: "권한이 없습니다" };
  }

  const parsed = ModuleIdSchema.safeParse(rawModuleId);
  if (!parsed.success) {
    return { ok: false, error: "알 수 없는 모듈입니다" };
  }
  const moduleId = parsed.data;

  await prisma.orgModuleInstall.deleteMany({
    where: { orgId: user.orgId, moduleId },
  });

  revalidatePath("/settings/modules");
  return { ok: true };
}
