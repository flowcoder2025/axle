import {
  checkDependencies,
  findDependents,
  topologicalSort,
} from "./dependencies.js";
import { getModule, getPack } from "./registry.js";
import type { InstallerDeps, ModuleId } from "./types.js";

export async function getInstalledModules(
  orgId: string,
  deps: InstallerDeps,
): Promise<ModuleId[]> {
  const rows = await deps.prisma.orgModuleInstall.findMany({
    where: { orgId },
    select: { moduleId: true },
  });
  return rows.map((r) => r.moduleId).sort();
}

export async function isModuleInstalled(
  orgId: string,
  moduleId: ModuleId,
  deps: InstallerDeps,
): Promise<boolean> {
  const row = await deps.prisma.orgModuleInstall.findUnique({
    where: { orgId_moduleId: { orgId, moduleId } },
  });
  return row !== null;
}

export async function installModule(
  orgId: string,
  moduleId: ModuleId,
  deps: InstallerDeps,
): Promise<void> {
  const module = getModule(moduleId);
  if (!module) {
    throw new Error(`Unknown module: ${moduleId}`);
  }

  const existing = await isModuleInstalled(orgId, moduleId, deps);
  if (existing) return;

  const installed = new Set(await getInstalledModules(orgId, deps));
  const check = checkDependencies(moduleId, installed);
  if (!check.ok) {
    throw new Error(
      `Cannot install ${moduleId}: missing hard deps [${check.missing.join(", ")}]`,
    );
  }

  await deps.prisma.orgModuleInstall.create({
    data: { orgId, moduleId },
  });

  if (module.onInstall) {
    await module.onInstall({ orgId, prisma: deps.prisma, ai: deps.ai });
  }
}

export async function installPack(
  orgId: string,
  packId: string,
  deps: InstallerDeps,
): Promise<void> {
  const pack = getPack(packId);
  if (!pack) {
    throw new Error(`Unknown pack: ${packId}`);
  }
  const sorted = topologicalSort(pack.modules);
  for (const moduleId of sorted) {
    await installModule(orgId, moduleId, deps);
  }
}

export async function uninstallModule(
  orgId: string,
  moduleId: ModuleId,
  deps: InstallerDeps,
): Promise<void> {
  const module = getModule(moduleId);
  if (!module) {
    throw new Error(`Unknown module: ${moduleId}`);
  }

  const installed = new Set(await getInstalledModules(orgId, deps));
  if (!installed.has(moduleId)) return;

  const dependents = findDependents(moduleId).filter((id) =>
    installed.has(id),
  );
  if (dependents.length > 0) {
    throw new Error(
      `Cannot uninstall ${moduleId}: installed dependents [${dependents.join(", ")}]`,
    );
  }

  await deps.prisma.orgModuleInstall.delete({
    where: { orgId_moduleId: { orgId, moduleId } },
  });

  if (module.onUninstall) {
    await module.onUninstall({ orgId, prisma: deps.prisma, ai: deps.ai });
  }
}
