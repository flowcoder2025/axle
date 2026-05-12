import { getModule, listModules } from "./registry.js";
import type { ModuleId } from "./types.js";

export interface DependencyCheckResult {
  ok: boolean;
  missing: ModuleId[];
}

/**
 * Check whether all hard dependencies of `moduleId` are present in
 * `installedSet`. Soft dependencies are intentionally ignored — they only
 * enable cross-pack integrations and must not block install.
 */
export function checkDependencies(
  moduleId: ModuleId,
  installedSet: Set<ModuleId>,
): DependencyCheckResult {
  const module = getModule(moduleId);
  if (!module) {
    throw new Error(`Unknown module: ${moduleId}`);
  }
  const hard = module.deps.hard ?? [];
  const missing = hard.filter((dep) => !installedSet.has(dep));
  return { ok: missing.length === 0, missing };
}

/**
 * Kahn's algorithm — orders `moduleIds` so that each module appears after all
 * its hard dependencies. Unknown ids are silently dropped (they're not in
 * the registry, so the installer cannot act on them).
 *
 * Throws on circular dependencies, which would indicate a registry bug.
 */
export function topologicalSort(moduleIds: ModuleId[]): ModuleId[] {
  const known = moduleIds.filter((id) => getModule(id) !== undefined);
  const inSet = new Set(known);

  const indegree = new Map<ModuleId, number>();
  const adjacency = new Map<ModuleId, ModuleId[]>();

  for (const id of known) {
    indegree.set(id, 0);
    adjacency.set(id, []);
  }

  for (const id of known) {
    const module = getModule(id)!;
    const hard = module.deps.hard ?? [];
    for (const dep of hard) {
      if (!inSet.has(dep)) continue;
      adjacency.get(dep)!.push(id);
      indegree.set(id, (indegree.get(id) ?? 0) + 1);
    }
  }

  const queue: ModuleId[] = [];
  for (const [id, deg] of indegree) {
    if (deg === 0) queue.push(id);
  }
  queue.sort();

  const result: ModuleId[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    result.push(id);
    for (const next of adjacency.get(id) ?? []) {
      const deg = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, deg);
      if (deg === 0) {
        const insertAt = queue.findIndex((q) => q > next);
        if (insertAt === -1) queue.push(next);
        else queue.splice(insertAt, 0, next);
      }
    }
  }

  if (result.length !== known.length) {
    throw new Error("Circular dependency detected in module graph");
  }
  return result;
}

/**
 * Find every module whose `deps.hard` includes `moduleId`. Used by the
 * uninstaller to determine cascade behaviour.
 */
export function findDependents(moduleId: ModuleId): ModuleId[] {
  return listModules()
    .filter((m) => (m.deps.hard ?? []).includes(moduleId))
    .map((m) => m.id)
    .sort();
}
