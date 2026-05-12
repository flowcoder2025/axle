/**
 * WI-618 — Dynamic sidebar builder.
 *
 * Marries three independent inputs into the `SidebarSection[]` shape that the
 * AppSidebar component renders:
 *   1. installedModules — from prisma.OrgModuleInstall (WI-616 model)
 *   2. userPermissions   — ReBAC scopes (WI-619 will replace the mock)
 *   3. registry catalog  — @axle/core-module-system (bootstrapped from
 *                          apps/web/src/lib/module-catalog.ts because the
 *                          per-module module.config.ts files only ship in
 *                          WI-622~626; per sprint-618 §제약, this WI may not
 *                          author those config files).
 *
 * The bootstrap converts every CatalogModule + CatalogPack to a ModuleConfig +
 * PackConfig with sensible defaults (no hard deps, plain permission `<id>:*`).
 * That gives the buildSidebar engine enough data to group modules under their
 * pack and filter by permission. Once WI-622+ lands, the bootstrap can be
 * dropped in favour of `import "@axle/pack-a/registry"` style side-effect
 * imports.
 */

import {
  buildSidebar as buildSidebarSections,
  clearRegistry,
  registerModule,
  registerPack,
  type ModuleConfig,
  type PackConfig,
  type SidebarSection,
} from "@axle/core-module-system";
import { PACK_CATALOG } from "./module-catalog";

let bootstrapped = false;

/**
 * Idempotently register every catalog pack + module into the in-memory
 * registry. Safe to call from every request — subsequent calls are no-ops.
 */
export function bootstrapPlatformRegistry(): void {
  if (bootstrapped) return;
  for (const pack of PACK_CATALOG) {
    const moduleIds = pack.modules.map((m) => m.id);
    const packConfig: PackConfig = {
      id: pack.id,
      label: pack.title,
      modules: moduleIds,
      pricing: { monthly: pack.pricing.monthly },
      recommended: pack.recommended,
    };
    registerPack(packConfig);

    for (const mod of pack.modules) {
      const moduleConfig: ModuleConfig = {
        id: mod.id,
        packId: pack.id,
        label: mod.label,
        route: `/${mod.id}`,
        // Until WI-619 wires actual ReBAC scopes, use the conventional
        // `<moduleId>:*` shape so a permission set like ["customers:*"] matches.
        permission: `${mod.id}:*`,
        multiOrg: mod.multiOrg,
        pbc: [],
        deps: {},
        prismaModels: [],
        admin: mod.admin,
      };
      registerModule(moduleConfig);
    }
  }
  bootstrapped = true;
}

/** Test-only — re-bootstrap on the next call. */
export function resetPlatformRegistry(): void {
  clearRegistry();
  bootstrapped = false;
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
 * Default permission loader — grants every catalog scope. Replaced by WI-619.
 * Returned as a fresh array each call so callers may mutate safely.
 */
async function grantAllPermissions(): Promise<string[]> {
  const scopes = new Set<string>();
  for (const pack of PACK_CATALOG) {
    for (const mod of pack.modules) {
      scopes.add(`${mod.id}:*`);
    }
  }
  // Admin scopes used by Pack B admin modules
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
