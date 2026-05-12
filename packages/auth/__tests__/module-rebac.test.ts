/**
 * WI-619 — Module ReBAC scope tests.
 *
 * Sprint contract §6 requires 7 scenarios. We cover:
 *   1. 권한 없음 — no held scopes → denied
 *   2. 정확한 scope — exact match → allowed
 *   3. 상위 scope — admin satisfies write; write satisfies read
 *   4. 와일드카드 scope — customers:* satisfies customers:read
 *   5. 권한이 다른 org에 있음 — leaked between orgs? must NOT.
 *   6. multi-org tenant 통과 — user holds tenant:<id> → checkTenantScope passes
 *   7. multi-org tenant 거부 — user without tenant grant → denied
 *
 * Plus utility tests for scopeSatisfies / scope catalog shape.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MODULE_SCOPES,
  anyScopeSatisfies,
  isKnownModuleScope,
  scopeSatisfies,
  checkModulePermission,
  checkModulePermissionLegacy,
  checkTenantScope,
  getUserModuleScopes,
  grantModuleScope,
  grantTenantScope,
  revokeModuleScope,
  setRelationStore,
  type RelationStore,
} from "../src/rebac/index.js";

/** Hand-rolled in-memory RelationStore (no prisma touch). */
function createMemoryStore(): RelationStore & { rows: Set<string> } {
  const rows = new Set<string>();
  const key = (
    namespace: string,
    objectId: string,
    relation: string,
    subjectType: string,
    subjectId: string,
  ) => `${namespace}|${objectId}|${relation}|${subjectType}|${subjectId}`;
  return {
    rows,
    async check(namespace, objectId, relation, subjectType, subjectId) {
      return rows.has(key(namespace, objectId, relation, subjectType, subjectId));
    },
    async grant(namespace, objectId, relation, subjectType, subjectId) {
      rows.add(key(namespace, objectId, relation, subjectType, subjectId));
    },
    async revoke(namespace, objectId, relation, subjectType, subjectId) {
      rows.delete(key(namespace, objectId, relation, subjectType, subjectId));
    },
    async listPermissions(subjectType, subjectId) {
      const out: Array<{
        namespace: string;
        objectId: string;
        relation: string;
      }> = [];
      for (const k of rows) {
        const [namespace, objectId, relation, st, sid] = k.split("|");
        if (st === subjectType && sid === subjectId) {
          out.push({ namespace, objectId, relation });
        }
      }
      return out;
    },
  };
}

describe("WI-619 — scope catalog", () => {
  it("includes a sample of expected scopes", () => {
    for (const expected of [
      "customers:*",
      "customers:read",
      "customers:write",
      "projects:*",
      "finance:*",
      "matching:*",
      "hr:read",
      "hr:write",
      "hr:admin",
      "content:admin",
      "erp:write",
      "automation:*",
      "platform:admin",
    ]) {
      expect(MODULE_SCOPES).toContain(expected);
    }
  });

  it("isKnownModuleScope recognises real scopes and rejects junk", () => {
    expect(isKnownModuleScope("customers:read")).toBe(true);
    expect(isKnownModuleScope("hr:admin")).toBe(true);
    expect(isKnownModuleScope("platform:admin")).toBe(true);
    expect(isKnownModuleScope("nonexistent:scope")).toBe(false);
    expect(isKnownModuleScope("customers:purge")).toBe(false);
  });
});

describe("WI-619 — scopeSatisfies (pure)", () => {
  it("exact match passes", () => {
    expect(scopeSatisfies("customers:read", "customers:read")).toBe(true);
  });

  it("wildcard on the held side covers any verb of the same resource", () => {
    expect(scopeSatisfies("customers:*", "customers:read")).toBe(true);
    expect(scopeSatisfies("customers:*", "customers:write")).toBe(true);
    expect(scopeSatisfies("customers:*", "customers:admin")).toBe(true);
  });

  it("wildcard on the required side passes when the user holds any verb", () => {
    expect(scopeSatisfies("customers:read", "customers:*")).toBe(true);
  });

  it("hierarchy: admin covers write and read", () => {
    expect(scopeSatisfies("hr:admin", "hr:write")).toBe(true);
    expect(scopeSatisfies("hr:admin", "hr:read")).toBe(true);
  });

  it("hierarchy: write covers read but NOT admin", () => {
    expect(scopeSatisfies("hr:write", "hr:read")).toBe(true);
    expect(scopeSatisfies("hr:write", "hr:admin")).toBe(false);
  });

  it("read does NOT cover write or admin", () => {
    expect(scopeSatisfies("hr:read", "hr:write")).toBe(false);
    expect(scopeSatisfies("hr:read", "hr:admin")).toBe(false);
  });

  it("different resources never overlap", () => {
    expect(scopeSatisfies("customers:admin", "projects:read")).toBe(false);
    expect(scopeSatisfies("hr:admin", "platform:admin")).toBe(false);
  });
});

describe("WI-619 — checkModulePermission scenarios", () => {
  let store: ReturnType<typeof createMemoryStore>;

  beforeEach(() => {
    store = createMemoryStore();
    setRelationStore(store);
  });
  afterEach(() => setRelationStore(null));

  // Scenario 1
  it("denies when the user holds no scopes", async () => {
    const allowed = await checkModulePermission("u1", "org-1", "customers:read");
    expect(allowed).toBe(false);
  });

  // Scenario 2
  it("allows when the held scope exactly matches", async () => {
    await grantModuleScope("u1", "org-1", "customers:read");
    expect(
      await checkModulePermission("u1", "org-1", "customers:read"),
    ).toBe(true);
  });

  // Scenario 3
  it("allows when a higher verb is held (hr:admin satisfies hr:write)", async () => {
    await grantModuleScope("u1", "org-1", "hr:admin");
    expect(await checkModulePermission("u1", "org-1", "hr:write")).toBe(true);
    expect(await checkModulePermission("u1", "org-1", "hr:read")).toBe(true);
    expect(await checkModulePermission("u1", "org-1", "hr:admin")).toBe(true);
  });

  // Scenario 4
  it("allows via wildcard (customers:* satisfies customers:write)", async () => {
    await grantModuleScope("u1", "org-1", "customers:*");
    expect(
      await checkModulePermission("u1", "org-1", "customers:write"),
    ).toBe(true);
  });

  // Scenario 5 — isolation across orgs
  it("isolates grants per org (org-1 grant does NOT leak to org-2)", async () => {
    await grantModuleScope("u1", "org-1", "customers:*");
    expect(
      await checkModulePermission("u1", "org-2", "customers:read"),
    ).toBe(false);
  });

  it("revoke removes the grant", async () => {
    await grantModuleScope("u1", "org-1", "customers:read");
    expect(
      await checkModulePermission("u1", "org-1", "customers:read"),
    ).toBe(true);
    await revokeModuleScope("u1", "org-1", "customers:read");
    expect(
      await checkModulePermission("u1", "org-1", "customers:read"),
    ).toBe(false);
  });

  it("getUserModuleScopes returns every held module scope (and nothing else)", async () => {
    await grantModuleScope("u1", "org-1", "customers:*");
    await grantModuleScope("u1", "org-1", "hr:write");
    await grantTenantScope("u1", "managed-1"); // different namespace — must not leak
    const held = await getUserModuleScopes("u1", "org-1");
    expect(held.sort()).toEqual(["customers:*", "hr:write"]);
  });
});

describe("WI-619 — checkTenantScope (Multi-org)", () => {
  let store: ReturnType<typeof createMemoryStore>;

  beforeEach(() => {
    store = createMemoryStore();
    setRelationStore(store);
  });
  afterEach(() => setRelationStore(null));

  // Scenario 6
  it("allows when the user holds the specific managed-org tenant grant", async () => {
    await grantTenantScope("u1", "managed-7");
    expect(await checkTenantScope("u1", "managed-7")).toBe(true);
  });

  it("allows when the user holds the wildcard tenant grant '*'", async () => {
    await grantTenantScope("u1", "*");
    expect(await checkTenantScope("u1", "managed-anything")).toBe(true);
  });

  // Scenario 7
  it("denies when the user holds no tenant grant", async () => {
    expect(await checkTenantScope("u1", "managed-7")).toBe(false);
  });

  it("denies when the user holds a grant for a DIFFERENT managed org", async () => {
    await grantTenantScope("u1", "managed-7");
    expect(await checkTenantScope("u1", "managed-8")).toBe(false);
  });

  it("getUserModuleScopes ignores tenant grants (correct namespace isolation)", async () => {
    await grantTenantScope("u1", "managed-7");
    const held = await getUserModuleScopes("u1", "org-1");
    expect(held).toEqual([]);
  });
});

describe("WI-619 — checkModulePermissionLegacy (backward-compat gate)", () => {
  let store: ReturnType<typeof createMemoryStore>;

  beforeEach(() => {
    store = createMemoryStore();
    setRelationStore(store);
  });
  afterEach(() => setRelationStore(null));

  it("allows users with NO module scopes for the org (legacy state)", async () => {
    expect(
      await checkModulePermissionLegacy("u1", "org-1", "finance:read"),
    ).toBe(true);
  });

  it("denies once at least one scope is granted but not the required one", async () => {
    await grantModuleScope("u1", "org-1", "customers:read");
    expect(
      await checkModulePermissionLegacy("u1", "org-1", "finance:read"),
    ).toBe(false);
  });

  it("allows when a satisfying scope is held", async () => {
    await grantModuleScope("u1", "org-1", "finance:*");
    expect(
      await checkModulePermissionLegacy("u1", "org-1", "finance:read"),
    ).toBe(true);
  });

  it("legacy gate is per-org (org-1 grants do not influence org-2 legacy)", async () => {
    await grantModuleScope("u1", "org-1", "customers:read");
    // org-2 still in legacy state for this user
    expect(
      await checkModulePermissionLegacy("u1", "org-2", "finance:read"),
    ).toBe(true);
  });
});

describe("WI-619 — anyScopeSatisfies", () => {
  it("returns true when ANY held scope satisfies the requirement", () => {
    expect(
      anyScopeSatisfies(["projects:read", "customers:admin"], "customers:write"),
    ).toBe(true);
  });

  it("returns false when no held scope satisfies", () => {
    expect(
      anyScopeSatisfies(["projects:read", "hr:read"], "customers:read"),
    ).toBe(false);
  });

  it("returns false for an empty held list", () => {
    expect(anyScopeSatisfies([], "customers:read")).toBe(false);
  });
});
