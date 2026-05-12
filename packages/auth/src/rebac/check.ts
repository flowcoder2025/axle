/**
 * WI-619 — ReBAC module scope checks.
 *
 * Thin permission layer built on top of `@axle/db`'s Zanzibar-style
 * `RelationTuple` table. Reuses `check` / `grant` / `revoke` / `listPermissions`
 * to avoid introducing a parallel storage path.
 */

import {
  MODULE_SCOPE_NAMESPACE,
  TENANT_SCOPE_NAMESPACE,
  anyScopeSatisfies,
} from "./scopes.js";

/**
 * Structural type for the relationship-tuple surface this module needs. The
 * production callers pass `@axle/db`'s `{ check, grant, revoke, listPermissions }`,
 * while tests pass a hand-rolled in-memory impl.
 */
export interface RelationStore {
  check: (
    namespace: string,
    objectId: string,
    relation: string,
    subjectType: string,
    subjectId: string,
  ) => Promise<boolean>;
  grant: (
    namespace: string,
    objectId: string,
    relation: string,
    subjectType: string,
    subjectId: string,
  ) => Promise<void>;
  revoke: (
    namespace: string,
    objectId: string,
    relation: string,
    subjectType: string,
    subjectId: string,
  ) => Promise<void>;
  listPermissions: (
    subjectType: string,
    subjectId: string,
  ) => Promise<
    Array<{ namespace: string; objectId: string; relation: string }>
  >;
}

let activeStore: RelationStore | null = null;

async function resolveStore(): Promise<RelationStore> {
  if (activeStore) return activeStore;
  const db = await import("@axle/db");
  return {
    check: db.check,
    grant: db.grant,
    revoke: db.revoke,
    listPermissions: db.listPermissions,
  };
}

/** Test-only — substitute the relation store. */
export function setRelationStore(store: RelationStore | null): void {
  activeStore = store;
}

/**
 * Return every module scope a user holds for `orgId`. The result is suitable
 * for feeding into {@link anyScopeSatisfies} or `buildSidebar`'s
 * `userPermissions` input.
 */
export async function getUserModuleScopes(
  userId: string,
  orgId: string,
): Promise<string[]> {
  const store = await resolveStore();
  const rows = await store.listPermissions("user", userId);
  return rows
    .filter(
      (row) =>
        row.namespace === MODULE_SCOPE_NAMESPACE && row.objectId === orgId,
    )
    .map((row) => row.relation);
}

/**
 * Test whether `userId` has access matching `scope` within `orgId`.
 *
 * The check is "any-of": the user passes if *any* held scope (exact, wildcard,
 * or a higher verb in the same resource) covers the required scope.
 */
export async function checkModulePermission(
  userId: string,
  orgId: string,
  scope: string,
): Promise<boolean> {
  const held = await getUserModuleScopes(userId, orgId);
  return anyScopeSatisfies(held, scope);
}

/**
 * Grant a module scope to a user inside an org. Idempotent.
 */
export async function grantModuleScope(
  userId: string,
  orgId: string,
  scope: string,
): Promise<void> {
  const store = await resolveStore();
  await store.grant(MODULE_SCOPE_NAMESPACE, orgId, scope, "user", userId);
}

/** Revoke a module scope. No-op when the row is absent. */
export async function revokeModuleScope(
  userId: string,
  orgId: string,
  scope: string,
): Promise<void> {
  const store = await resolveStore();
  await store.revoke(MODULE_SCOPE_NAMESPACE, orgId, scope, "user", userId);
}

/**
 * Multi-org tenant scope check (WI-620 cooperation).
 *
 * A user passes when they hold either:
 *   - `tenant-scope:* / access / user:<id>`  (every managed org), or
 *   - `tenant-scope:<activeTenantId> / access / user:<id>`  (specific tenant).
 */
export async function checkTenantScope(
  userId: string,
  activeTenantId: string,
): Promise<boolean> {
  const store = await resolveStore();
  if (
    await store.check(TENANT_SCOPE_NAMESPACE, "*", "access", "user", userId)
  ) {
    return true;
  }
  return store.check(
    TENANT_SCOPE_NAMESPACE,
    activeTenantId,
    "access",
    "user",
    userId,
  );
}

/** Grant a user access to a specific managed-org tenant (or `*` for all). */
export async function grantTenantScope(
  userId: string,
  managedOrgId: string,
): Promise<void> {
  const store = await resolveStore();
  await store.grant(
    TENANT_SCOPE_NAMESPACE,
    managedOrgId,
    "access",
    "user",
    userId,
  );
}

export async function revokeTenantScope(
  userId: string,
  managedOrgId: string,
): Promise<void> {
  const store = await resolveStore();
  await store.revoke(
    TENANT_SCOPE_NAMESPACE,
    managedOrgId,
    "access",
    "user",
    userId,
  );
}

/**
 * Backward-compatible gate for RSC pages and Route Handlers.
 *
 * Behaviour:
 *   - User has a scope satisfying `scope` → allow.
 *   - User has at least one module scope for `orgId` but not this one → deny.
 *   - User has NO module scopes for `orgId` at all → allow (legacy state —
 *     no grants have been seeded for this org yet, so we don't break pages
 *     that already work today).
 *
 * Returns `true` if access should be granted. Callers decide how to deny
 * (e.g. `notFound()` for RSC pages, 403 NextResponse for Route Handlers).
 */
export async function checkModulePermissionLegacy(
  userId: string,
  orgId: string,
  scope: string,
): Promise<boolean> {
  const held = await getUserModuleScopes(userId, orgId);
  if (held.length === 0) return true;
  return anyScopeSatisfies(held, scope);
}
