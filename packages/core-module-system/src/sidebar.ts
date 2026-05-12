import { getModule, getPack, listPacks } from "./registry.js";
import type {
  BuildSidebarInput,
  ModuleConfig,
  NavItem,
  SidebarSection,
} from "./types.js";

/**
 * Match a user-held permission scope against a module's required permission.
 *
 * Rules:
 * - Exact match always passes.
 * - A module that requires `"customers:*"` is satisfied by any
 *   `customers:<verb>` scope (e.g. `customers:read`) or by the wildcard itself.
 * - A user holding `"customers:*"` satisfies any specific `customers:<verb>`
 *   requirement.
 */
function permissionMatches(
  required: string,
  userPermissions: string[],
): boolean {
  if (userPermissions.includes(required)) return true;
  const [reqResource, reqVerb] = required.split(":");
  for (const held of userPermissions) {
    const [resource, verb] = held.split(":");
    if (resource !== reqResource) continue;
    if (verb === "*") return true;
    if (reqVerb === "*" && verb && verb.length > 0) return true;
  }
  return false;
}

function toNavItem(
  module: ModuleConfig,
  activeTenant: string | undefined,
): NavItem {
  return {
    moduleId: module.id,
    label: module.label,
    route: module.route,
    icon: module.icon,
    tenantScoped: module.multiOrg && activeTenant !== undefined,
    requiresDesktop: module.requiresDesktop,
  };
}

/**
 * Build the sidebar navigation tree for a user's session.
 *
 * Layout:
 * - Each Pack containing at least one visible installed module becomes a
 *   section. Recommended packs sort first, then alphabetically by `id`.
 * - Admin-flagged modules are grouped into a single trailing "Admin" section
 *   regardless of pack.
 * - A module is visible only if it is installed AND the user holds a matching
 *   permission scope.
 */
export function buildSidebar(input: BuildSidebarInput): SidebarSection[] {
  const installedSet = new Set(input.installedModules);
  const sections: SidebarSection[] = [];
  const adminItems: NavItem[] = [];

  const packs = [...listPacks()].sort((a, b) => {
    if (!!a.recommended !== !!b.recommended) {
      return a.recommended ? -1 : 1;
    }
    return a.id.localeCompare(b.id);
  });

  for (let i = 0; i < packs.length; i++) {
    const pack = packs[i];
    const items: NavItem[] = [];
    for (const moduleId of pack.modules) {
      if (!installedSet.has(moduleId)) continue;
      const module = getModule(moduleId);
      if (!module) continue;
      if (!permissionMatches(module.permission, input.userPermissions))
        continue;
      if (module.admin) {
        adminItems.push(toNavItem(module, input.activeTenant));
        continue;
      }
      items.push(toNavItem(module, input.activeTenant));
    }
    if (items.length > 0) {
      sections.push({
        id: pack.id,
        label: pack.label,
        items,
        order: i,
      });
    }
  }

  // Admin modules without a registered pack still need to appear.
  for (const moduleId of input.installedModules) {
    const module = getModule(moduleId);
    if (!module || !module.admin) continue;
    if (adminItems.some((it) => it.moduleId === moduleId)) continue;
    if (!permissionMatches(module.permission, input.userPermissions)) continue;
    const pack = getPack(module.packId);
    if (pack) continue; // already considered above
    adminItems.push(toNavItem(module, input.activeTenant));
  }

  if (adminItems.length > 0) {
    sections.push({
      id: "admin",
      label: "Admin",
      items: adminItems.sort((a, b) => a.label.localeCompare(b.label)),
      order: sections.length,
    });
  }

  return sections;
}
