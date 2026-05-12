/**
 * @axle/auth — Auth.js v5 Split Config
 *
 * Export map:
 * - auth, signIn, signOut, handlers  → Node.js runtime (Next.js Route Handler / Server Actions)
 * - authConfig                        → Edge-compatible config (middleware)
 * - getCurrentUser, requireUser, requireOrg, requireOrgAdmin, requirePlatformAdmin → DAL helpers (Server Components)
 * - getCachedSession, invalidateCachedSession → 3-tier session cache
 */

export const AUTH_PACKAGE = "@axle/auth" as const;

// Node.js runtime exports
export { auth, signIn, signOut, handlers } from "./auth.js";

// Edge-compatible config
export { authConfig } from "./auth.config.js";

// Middleware helper (Edge)
export { auth as authMiddleware, config as middlewareConfig } from "./middleware.js";

// Data Access Layer
export {
  getCurrentUser,
  requireUser,
  requireOrg,
  requireOrgAdmin,
  requirePlatformAdmin,
  invalidateUserCache,
} from "./dal.js";

// Session cache
export { getCachedSession, invalidateCachedSession } from "./session-cache.js";

// WI-619: Module scope ReBAC
export {
  MODULE_SCOPES,
  MODULE_SCOPE_NAMESPACE,
  TENANT_SCOPE_NAMESPACE,
  anyScopeSatisfies,
  checkModulePermission,
  checkModulePermissionLegacy,
  checkTenantScope,
  getUserModuleScopes,
  grantModuleScope,
  grantTenantScope,
  isKnownModuleScope,
  revokeModuleScope,
  revokeTenantScope,
  scopeSatisfies,
  setRelationStore,
  type ModuleScope,
  type RelationStore,
} from "./rebac/index.js";
