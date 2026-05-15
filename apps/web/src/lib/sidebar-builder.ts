/**
 * WI-618 → WI-702 → WI-704 — Dynamic sidebar builder.
 *
 * Marries three independent inputs into the `SidebarSection[]` shape that the
 * AppSidebar component renders:
 *   1. installedModules — from prisma.OrgModuleInstall (WI-616 model)
 *   2. userPermissions   — ReBAC scopes via @axle/auth.getUserModuleScopes
 *                          (real loader as of WI-704, with legacy fallback)
 *   3. registry catalog  — @axle/core-module-system, populated from
 *                          `apps/web/src/modules/registry.ts` via
 *                          `registerAllPacks()` (WI-622~626 + WI-701 own the
 *                          per-pack `module.config.ts` files).
 *
 * Note: `module-catalog.ts` (PACK_CATALOG) is still consumed for UI display
 * (settings/pack-card.tsx, billing summary). Only the runtime registry
 * bootstrap was migrated in WI-702.
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
   * Default impl (WI-704) reads from @axle/auth.getUserModuleScopes with a
   * legacy fallback to grant-all for orgs that haven't been seeded yet.
   */
  loadUserPermissions: (userId: string, orgId: string) => Promise<string[]>;
}

/**
 * Grant every registry resource scope. Used as the legacy fallback when an
 * org has no ReBAC rows seeded yet — mirrors `checkModulePermissionLegacy`'s
 * "no scopes → allow" rule so existing prod users keep their sidebar until
 * the org adopts ReBAC seeds. Derives scopes from the actual permission
 * strings declared on registered modules (e.g. `erp:read` → grants `erp:*`),
 * so it stays in sync with the registry's permission scheme. Returned as a
 * fresh array each call so callers may mutate safely.
 *
 * Exported for tests (`grantAllPermissions` was the WI-618 mock default).
 */
export async function grantAllPermissions(): Promise<string[]> {
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
 * Default WI-704 permission loader — reads the user's real ReBAC scopes for
 * the given org. When the user holds zero module scopes for `orgId` we fall
 * back to {@link grantAllPermissions}, mirroring the legacy gate documented
 * on `checkModulePermissionLegacy`: an unseeded org keeps working until the
 * platform explicitly grants scopes. Once any scope is seeded for a user,
 * sidebar visibility tightens to that user's actual grants.
 */
export async function loadRealUserPermissions(
  userId: string,
  orgId: string,
): Promise<string[]> {
  // Import from the `@axle/auth/rebac` subpath rather than the `@axle/auth`
  // barrel. The barrel transitively loads `next-auth` → `next/server`, which
  // works under Next.js but breaks the vitest node-ESM resolver. The subpath
  // resolves only the ReBAC helpers we actually need here, in both runtimes.
  const { getUserModuleScopes } = await import("@axle/auth/rebac");
  const scopes = await getUserModuleScopes(userId, orgId);
  if (scopes.length === 0) {
    return grantAllPermissions();
  }
  return scopes;
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
  loadUserPermissions: loadRealUserPermissions,
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
