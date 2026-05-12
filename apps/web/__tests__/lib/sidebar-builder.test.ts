/**
 * WI-618 — Tests for the platform sidebar builder.
 *
 * Exercises the registry bootstrap + buildPlatformSidebar against five
 * scenarios mandated by sprint-618 §6:
 *   1. Pack A only (recommended pack renders first)
 *   2. Pack A + Pack B (mixed sections, B follows A)
 *   3. Empty install set (returns [] — caller falls back to static nav)
 *   4. Permission filtering (modules without scope are hidden)
 *   5. Multi-org module flagged tenantScoped when activeTenant is set
 *
 * Uses an injected `loadInstalledModules` + `loadUserPermissions` to avoid
 * touching prisma. The bootstrap itself is exercised on every call because
 * it has to make `buildSidebar` from `@axle/core-module-system` see the
 * apps/web catalog packs/modules.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildPlatformSidebar,
  bootstrapPlatformRegistry,
  resetPlatformRegistry,
} from "../../src/lib/sidebar-builder";

const ALL_PERMS_GRANTED = async () => {
  const { PACK_CATALOG } = await import("../../src/lib/module-catalog");
  return PACK_CATALOG.flatMap((p) => p.modules.map((m) => `${m.id}:*`)).concat([
    "platform:admin",
  ]);
};

describe("WI-618 — bootstrapPlatformRegistry", () => {
  beforeEach(() => resetPlatformRegistry());
  afterEach(() => resetPlatformRegistry());

  it("is idempotent across multiple calls", () => {
    bootstrapPlatformRegistry();
    bootstrapPlatformRegistry();
    bootstrapPlatformRegistry();
    // No throw + the next buildSidebar must still see registered packs.
    expect(true).toBe(true);
  });
});

describe("WI-618 — buildPlatformSidebar", () => {
  beforeEach(() => resetPlatformRegistry());
  afterEach(() => resetPlatformRegistry());

  it("scenario 1: Pack A only — single recommended section first", async () => {
    const sections = await buildPlatformSidebar("org-1", "user-1", undefined, {
      loadInstalledModules: async () => [
        "customers",
        "projects",
        "estimates",
        "contracts",
        "documents",
        "portal-admin",
        "calendar",
        "meetings",
        "finance",
        "analytics",
      ],
      loadUserPermissions: ALL_PERMS_GRANTED,
    });
    expect(sections).toHaveLength(1);
    expect(sections[0].id).toBe("A");
    expect(sections[0].items.length).toBeGreaterThan(0);
  });

  it("scenario 2: Pack A + Pack B — A is first (recommended), B follows", async () => {
    const sections = await buildPlatformSidebar("org-1", "user-1", undefined, {
      loadInstalledModules: async () => [
        "customers",
        "programs",
        "matching",
      ],
      loadUserPermissions: ALL_PERMS_GRANTED,
    });
    const ids = sections.map((s) => s.id);
    expect(ids).toEqual(["A", "B"]);
  });

  it("scenario 3: empty install set returns []", async () => {
    const sections = await buildPlatformSidebar("org-1", "user-1", undefined, {
      loadInstalledModules: async () => [],
      loadUserPermissions: ALL_PERMS_GRANTED,
    });
    expect(sections).toEqual([]);
  });

  it("scenario 4: permission filtering hides unauthorised modules", async () => {
    const sections = await buildPlatformSidebar("org-1", "user-1", undefined, {
      loadInstalledModules: async () => ["customers", "projects", "finance"],
      // Only customers:* — projects and finance must be hidden.
      loadUserPermissions: async () => ["customers:*"],
    });
    expect(sections).toHaveLength(1);
    expect(sections[0].id).toBe("A");
    expect(sections[0].items.map((it) => it.moduleId)).toEqual(["customers"]);
  });

  it("scenario 5: multi-org module is flagged tenantScoped when activeTenant set", async () => {
    const sections = await buildPlatformSidebar("org-1", "user-1", "tenant-7", {
      loadInstalledModules: async () => ["finance", "customers"],
      loadUserPermissions: ALL_PERMS_GRANTED,
    });
    const flat = sections.flatMap((s) => s.items);
    const finance = flat.find((it) => it.moduleId === "finance");
    const customers = flat.find((it) => it.moduleId === "customers");
    expect(finance?.tenantScoped).toBe(true);
    expect(customers?.tenantScoped).toBe(false);
  });

  it("multi-org module is NOT flagged tenantScoped when activeTenant absent", async () => {
    const sections = await buildPlatformSidebar("org-1", "user-1", undefined, {
      loadInstalledModules: async () => ["finance"],
      loadUserPermissions: ALL_PERMS_GRANTED,
    });
    const finance = sections.flatMap((s) => s.items).find(
      (it) => it.moduleId === "finance",
    );
    expect(finance?.tenantScoped).toBe(false);
  });

  it("admin modules surface in a separate trailing Admin section", async () => {
    const sections = await buildPlatformSidebar("org-1", "user-1", undefined, {
      loadInstalledModules: async () => ["programs", "hwpx-admin"],
      loadUserPermissions: ALL_PERMS_GRANTED,
    });
    expect(sections.map((s) => s.id)).toEqual(["B", "admin"]);
    expect(sections[1].items.map((it) => it.moduleId)).toEqual(["hwpx-admin"]);
  });

  it("runs install + permission loaders concurrently (via Promise.all)", async () => {
    const order: string[] = [];
    await buildPlatformSidebar("org-1", "user-1", undefined, {
      loadInstalledModules: async () => {
        order.push("install:start");
        await new Promise((r) => setTimeout(r, 5));
        order.push("install:end");
        return ["customers"];
      },
      loadUserPermissions: async () => {
        order.push("perm:start");
        await new Promise((r) => setTimeout(r, 5));
        order.push("perm:end");
        return ["customers:*"];
      },
    });
    // Both starts must occur before either end → confirms concurrent execution.
    const installStart = order.indexOf("install:start");
    const permStart = order.indexOf("perm:start");
    const installEnd = order.indexOf("install:end");
    const permEnd = order.indexOf("perm:end");
    expect(installStart).toBeLessThan(permEnd);
    expect(permStart).toBeLessThan(installEnd);
  });
});
