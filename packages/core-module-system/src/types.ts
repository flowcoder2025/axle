/**
 * Core type definitions for the AXLE module system.
 *
 * The platform composes itself from {@link ModuleConfig} entries grouped into
 * {@link PackConfig} bundles. A registry holds the in-memory catalog, and the
 * sidebar builder turns installed modules + permissions into navigation data.
 */

export type ModuleId = string;
export type PackId = string;

export interface WidgetDef {
  id: string;
  label: string;
  /** Dashboard slot or route segment the widget renders into. */
  slot?: string;
}

export interface ModuleDeps {
  /** Modules that must already be installed; install is blocked if missing. */
  hard?: ModuleId[];
  /** Modules that enable optional cross-pack integrations when both installed. */
  soft?: ModuleId[];
}

export interface ModuleInstallHookContext {
  orgId: string;
  /**
   * Prisma client surface. Untyped at the package layer to keep the package
   * free of `@prisma/client` direct dependency (constraint of WI-616).
   */
  prisma: PrismaClientLike;
  ai?: unknown;
}

export interface ModuleConfig {
  id: ModuleId;
  packId: PackId;
  label: string;
  icon?: string;
  route: string;
  /** ReBAC scope required to access the module (e.g. "customers:*"). */
  permission: string;
  /** When true, queries should be scoped by `tenantOrgId` (Multi-org tier). */
  multiOrg: boolean;
  /** PBC packages this module depends on (informational, no runtime check). */
  pbc: string[];
  deps: ModuleDeps;
  prismaModels: string[];
  widgets?: WidgetDef[];
  onInstall?: (ctx: ModuleInstallHookContext) => Promise<void>;
  onUninstall?: (ctx: ModuleInstallHookContext) => Promise<void>;
  /** Admin-only module — surfaces under the admin sidebar section. */
  admin?: boolean;
  /** Requires the Desktop Companion app (Pack G). */
  requiresDesktop?: boolean;
}

export interface PackPricing {
  monthly: number;
  /** Optional per-unit cost (e.g. per employee for HR). */
  perUnit?: number;
}

export interface PackConfig {
  id: PackId;
  label: string;
  modules: ModuleId[];
  pricing: PackPricing;
  /** Default-recommended Pack — surfaces first in catalogs and sidebar. */
  recommended?: boolean;
  icon?: string;
}

export interface NavItem {
  moduleId: ModuleId;
  label: string;
  route: string;
  icon?: string;
  /** UI hint: this module is currently scoped to a managed-org tenant. */
  tenantScoped?: boolean;
  /** UI hint: requires Desktop Companion. */
  requiresDesktop?: boolean;
}

export interface SidebarSection {
  /** Pack id ("A", "B", …) or "admin" for the admin section. */
  id: string;
  label: string;
  items: NavItem[];
  /** Stable sort key — recommended packs first, then alphabetical. */
  order: number;
}

/**
 * Structural subset of the Prisma client used by the installer. Keeps this
 * package free of a direct `@prisma/client` dependency so it can be unit
 * tested with a hand-rolled in-memory mock.
 */
export interface PrismaClientLike {
  orgModuleInstall: {
    findMany: (args: {
      where: { orgId: string };
      select?: { moduleId: true };
    }) => Promise<Array<{ moduleId: string }>>;
    findUnique: (args: {
      where: { orgId_moduleId: { orgId: string; moduleId: string } };
    }) => Promise<{ moduleId: string } | null>;
    create: (args: {
      data: { orgId: string; moduleId: string; settings?: unknown };
    }) => Promise<unknown>;
    delete: (args: {
      where: { orgId_moduleId: { orgId: string; moduleId: string } };
    }) => Promise<unknown>;
  };
}

export interface InstallerDeps {
  prisma: PrismaClientLike;
  ai?: unknown;
}

export interface BuildSidebarInput {
  orgId: string;
  userId: string;
  /** Active managed-org tenant id when the user has switched contexts. */
  activeTenant?: string;
  /** Modules currently installed for `orgId`. */
  installedModules: ModuleId[];
  /** ReBAC scopes the user holds (e.g. "customers:read", "hr:write"). */
  userPermissions: string[];
}
