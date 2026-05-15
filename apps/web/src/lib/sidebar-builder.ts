/**
 * WI-618 → WI-702 — Dynamic sidebar builder.
 *
 * Marries three independent inputs into the `SidebarSection[]` shape that the
 * AppSidebar component renders:
 *   1. installedModules — from prisma.OrgModuleInstall (WI-616 model)
 *   2. userPermissions   — ReBAC scopes (WI-704 will replace the mock)
 *   3. registry catalog  — @axle/core-module-system, populated from
 *                          `apps/web/src/modules/registry.ts` via
 *                          `registerAllPacks()` (WI-622~626 + WI-701 own the
 *                          per-pack `module.config.ts` files).
 *
 * Note: `module-catalog.ts` (PACK_CATALOG) is still consumed for UI display
 * (settings/pack-card.tsx, billing summary, the default "grant all" permission
 * scope generator below). Only the runtime registry bootstrap was migrated in
 * WI-702.
 */

import {
  buildSidebar as buildSidebarSections,
  type SidebarSection,
} from "@axle/core-module-system";
import {
  ALL_MODULES,
  registerAllPacks,
  resetPlatformRegistration,
} from "../modules/registry";

/**
 * Idempotently register every pack + module into the in-memory registry.
 * Delegates to `registerAllPacks()` which is itself idempotent.
 */
export function bootstrapPlatformRegistry(): void {
  registerAllPacks();
}

/** Test-only — clear the registry and let the next call re-register. */
export function resetPlatformRegistry(): void {
  resetPlatformRegistration();
}

export interface SidebarBuilderDeps {
  /** Returns the moduleIds the org has installed. */
  loadInstalledModules: (orgId: string) => Promise<string[]>;
  /**
   * Returns the user's ReBAC scopes (e.g. ["customers:*", "hr:write"]).
   * WI-619 will replace the default impl with the real ReBAC lookup; until
   * then we ship a "grant everything" mock so users can navigate the UI.
   */
  loadUserPermissions: (userId: string, orgId: string) => Promise<string[]>;
}

/**
 * Default permission loader — grants every registry resource scope. Replaced
 * by WI-704 (real ReBAC lookup). Derives scopes from the actual permission
 * strings declared on registered modules (e.g. `erp:read` → grants `erp:*`),
 * so post-WI-702 the loader stays in sync with the registry's permission
 * scheme. Returned as a fresh array each call so callers may mutate safely.
 */
async function grantAllPermissions(): Promise<string[]> {
  const scopes = new Set<string>();
  for (const mod of ALL_MODULES) {
    const [resource] = mod.permission.split(":");
    if (resource) scopes.add(`${resource}:*`);
  }
  // Admin scopes used by admin-flagged modules (e.g. Pack B HWPX templates).
  scopes.add("platform:admin");
  return Array.from(scopes);
}

/**
 * Default install-set loader — reads from prisma. Split into a deps object so
 * tests can substitute an in-memory implementation without polluting the
 * application path.
 */
async function defaultLoadInstalledModules(orgId: string): Promise<string[]> {
  const { prisma } = await import("@axle/db");
  const rows = await prisma.orgModuleInstall.findMany({
    where: { orgId },
    select: { moduleId: true },
  });
  return rows.map((r) => r.moduleId);
}

const defaultDeps: SidebarBuilderDeps = {
  loadInstalledModules: defaultLoadInstalledModules,
  loadUserPermissions: grantAllPermissions,
};

/**
 * Build the platform sidebar for the given org+user session.
 *
 * The returned array is empty when nothing is installed *or* the user has no
 * matching permissions — callers should fall back to a static menu in that
 * case so the user still has navigation.
 */
export async function buildPlatformSidebar(
  orgId: string,
  userId: string,
  activeTenant?: string,
  deps: SidebarBuilderDeps = defaultDeps,
): Promise<SidebarSection[]> {
  bootstrapPlatformRegistry();

  const [installedModules, userPermissions] = await Promise.all([
    deps.loadInstalledModules(orgId),
    deps.loadUserPermissions(userId, orgId),
  ]);

  return buildSidebarSections({
    orgId,
    userId,
    activeTenant,
    installedModules,
    userPermissions,
  });
}
