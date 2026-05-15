/**
 * WI-704 — Tests for the real-ReBAC default permission loader.
 *
 * The default `loadUserPermissions` shipped by `sidebar-builder` now calls
 * `@axle/auth.getUserModuleScopes(userId, orgId)`. To preserve existing prod
 * behaviour for orgs that haven't been seeded yet, the loader falls back to
 * the grant-all helper when the user holds zero scopes for `orgId`.
 *
 * We import directly from `@axle/auth/rebac` to bypass the barrel's
 * transitive load of `next-auth` → `next/server`, which vitest cannot resolve
 * under its node ESM strategy. The production runtime path still uses the
 * lazy-imported `@axle/auth` barrel inside `loadRealUserPermissions`.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  grantModuleScope,
  setRelationStore,
  type RelationStore,
} from "@axle/auth/rebac";
import {
  buildPlatformSidebar,
  loadRealUserPermissions,
  resetPlatformRegistry,
} from "../../src/lib/sidebar-builder";

/** Hand-rolled in-memory RelationStore — mirrors packages/auth's test helper. */
function createMemoryStore(): RelationStore {
  const rows = new Set<string>();
  const key = (
    namespace: string,
    objectId: string,
    relation: string,
    subjectType: string,
    subjectId: string,
  ) => `${namespace}|${objectId}|${relation}|${subjectType}|${subjectId}`;
  return {
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

describe("WI-704 — loadRealUserPermissions (default loader)", () => {
  beforeEach(() => setRelationStore(createMemoryStore()));
  afterEach(() => setRelationStore(null));

  it("falls back to grant-all when the user has zero scopes for the org", async () => {
    const scopes = await loadRealUserPermissions("user-1", "org-1");
    // grant-all derives `<resource>:*` scopes from ALL_MODULES + platform:admin.
    expect(scopes).toContain("platform:admin");
    expect(scopes.length).toBeGreaterThan(5);
    for (const s of scopes) {
      expect(s.endsWith(":*") || s === "platform:admin").toBe(true);
    }
  });

  it("returns only the held scopes once the user is seeded", async () => {
    await grantModuleScope("user-1", "org-1", "customers:*");
    await grantModuleScope("user-1", "org-1", "hr:read");
    const scopes = await loadRealUserPermissions("user-1", "org-1");
    expect(scopes.sort()).toEqual(["customers:*", "hr:read"]);
  });

  it("does not leak scopes across orgs", async () => {
    await grantModuleScope("user-1", "org-2", "customers:*");
    const scopes = await loadRealUserPermissions("user-1", "org-1");
    // org-1 has no rows → legacy fallback (not org-2's customers:*).
    expect(scopes).toContain("platform:admin");
    expect(scopes.length).toBeGreaterThan(1);
  });
});

describe("WI-704 — buildPlatformSidebar with seeded scopes", () => {
  beforeEach(() => {
    resetPlatformRegistry();
    setRelationStore(createMemoryStore());
  });
  afterEach(() => {
    resetPlatformRegistry();
    setRelationStore(null);
  });

  it("filters the sidebar to exactly the seeded module's pack", async () => {
    await grantModuleScope("user-1", "org-1", "customers:*");
    const sections = await buildPlatformSidebar("org-1", "user-1", undefined, {
      loadInstalledModules: async () => ["customers", "projects", "finance"],
      loadUserPermissions: loadRealUserPermissions,
    });
    const flatIds = sections.flatMap((s) => s.items.map((it) => it.moduleId));
    expect(flatIds).toEqual(["customers"]);
  });

  it("legacy fallback keeps every installed module visible when no scopes seeded", async () => {
    const sections = await buildPlatformSidebar("org-1", "user-1", undefined, {
      loadInstalledModules: async () => ["customers", "projects", "finance"],
      loadUserPermissions: loadRealUserPermissions,
    });
    const flatIds = sections.flatMap((s) => s.items.map((it) => it.moduleId));
    expect(flatIds).toEqual(
      expect.arrayContaining(["customers", "projects", "finance"]),
    );
  });
});
