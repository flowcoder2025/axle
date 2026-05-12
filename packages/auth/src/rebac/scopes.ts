/**
 * WI-619 — Module scope catalog for ReBAC.
 *
 * A scope is the relation string we store on `RelationTuple` rows under the
 * `module-scope` namespace. The full row shape is:
 *
 *   {
 *     namespace:   "module-scope",
 *     objectId:    <orgId>,        // the org the grant is scoped to
 *     relation:    <scope>,         // e.g. "customers:read" or "hr:admin"
 *     subjectType: "user",
 *     subjectId:   <userId>,
 *   }
 *
 * Tenant scopes (Multi-org tier, WI-620) use the `tenant-scope` namespace
 * with objectId = `<managedOrgId>` (or "*" for "every managed org").
 */

export const MODULE_SCOPE_NAMESPACE = "module-scope" as const;
export const TENANT_SCOPE_NAMESPACE = "tenant-scope" as const;

/** Resources that follow the `<resource>:*` wildcard convention. */
const WILDCARD_RESOURCES = [
  "customers",
  "projects",
  "estimates",
  "contracts",
  "documents",
  "portal",
  "calendar",
  "meetings",
  "finance",
  "analytics",
  "programs",
  "matching",
  "journals",
  "automation",
  "certs",
  "recording",
] as const;

/** Resources that use the read/write/admin hierarchy. */
const HIERARCHY_RESOURCES = ["hr", "content"] as const;

/** Resources that only expose read + write. */
const READ_WRITE_RESOURCES = ["erp"] as const;

const wildcardScopes = WILDCARD_RESOURCES.flatMap((r) => [
  `${r}:read`,
  `${r}:write`,
  `${r}:admin`,
  `${r}:*`,
]);

const hierarchyScopes = HIERARCHY_RESOURCES.flatMap((r) => [
  `${r}:read`,
  `${r}:write`,
  `${r}:admin`,
]);

const readWriteScopes = READ_WRITE_RESOURCES.flatMap((r) => [
  `${r}:read`,
  `${r}:write`,
]);

/**
 * Flat list of every recognised module scope. Use this as the source of truth
 * for zod enum validation and registry bootstrap.
 */
export const MODULE_SCOPES: readonly string[] = [
  ...wildcardScopes,
  ...hierarchyScopes,
  ...readWriteScopes,
  // Admin scopes for Pack B admin modules (HWPX templates, checklist,
  // AI patterns). Single platform-wide scope per sprint contract.
  "platform:admin",
];

export type ModuleScope = (typeof MODULE_SCOPES)[number];

const SCOPE_SET = new Set(MODULE_SCOPES);

export function isKnownModuleScope(scope: string): scope is ModuleScope {
  return SCOPE_SET.has(scope);
}

/** Verb levels for hierarchical matching. Higher == covers lower. */
const VERB_RANK: Record<string, number> = {
  read: 1,
  write: 2,
  admin: 3,
};

/**
 * Decide whether `held` (a scope a user owns) satisfies `required` (the scope
 * the caller is asking about).
 *
 * Rules, in order:
 *   1. Exact match → pass.
 *   2. `<resource>:*` covers any `<resource>:<verb>` request (and vice-versa).
 *   3. Within the same resource, a higher verb covers a lower one:
 *      admin ≥ write ≥ read. So holding `hr:admin` passes `hr:read`.
 *   4. `platform:admin` is platform-wide and never overlaps module scopes.
 */
export function scopeSatisfies(held: string, required: string): boolean {
  if (held === required) return true;

  const [heldResource, heldVerb] = held.split(":");
  const [reqResource, reqVerb] = required.split(":");

  if (heldResource !== reqResource) return false;

  // Wildcard either way
  if (heldVerb === "*" && reqVerb && reqVerb.length > 0) return true;
  if (reqVerb === "*" && heldVerb && heldVerb.length > 0) return true;

  const heldRank = VERB_RANK[heldVerb];
  const reqRank = VERB_RANK[reqVerb];
  if (heldRank && reqRank && heldRank >= reqRank) return true;

  return false;
}

/**
 * Check a user's held-scope list against a required scope.
 * Convenience wrapper that runs {@link scopeSatisfies} over the array.
 */
export function anyScopeSatisfies(
  heldScopes: readonly string[],
  required: string,
): boolean {
  for (const held of heldScopes) {
    if (scopeSatisfies(held, required)) return true;
  }
  return false;
}
