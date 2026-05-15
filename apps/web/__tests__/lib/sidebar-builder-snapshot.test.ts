/**
 * WI-702 — Regression snapshot for the sidebar builder.
 *
 * Locks down the section/item shape produced by `buildPlatformSidebar` so that
 * the WI-702 refactor (bootstrap → registry.registerAllPacks handoff) cannot
 * silently change the navigation tree.
 *
 * Two tests:
 *   1. Default install (one module per pack) + resource-level scopes — captures
 *      the canonical sidebar layout as an inline snapshot.
 *   2. Pack F (ERP) — verifies that installing only `products` + `intake` with
 *      an `erp:*` scope produces a Pack F section containing both modules.
 *      This guards the new registry-based permission scheme used by Phase 20.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { clearRegistry } from "@axle/core-module-system";
import {
  buildPlatformSidebar,
  resetPlatformRegistry,
} from "../../src/lib/sidebar-builder";

describe("sidebar-builder bootstrap → registry handoff (WI-702)", () => {
  beforeEach(() => {
    clearRegistry();
    resetPlatformRegistry();
  });

  it("produces stable sections — snapshot", async () => {
    const sections = await buildPlatformSidebar(
      "org_test",
      "u1",
      undefined,
      {
        loadInstalledModules: async () => [
          "customers",
          "programs",
          "employees",
          "create",
          "products",
          "intake",
          "automation",
        ],
        loadUserPermissions: async () => [
          "customers:*",
          "programs:*",
          "hr:*",
          "content:*",
          "erp:*",
          "automation:*",
        ],
      },
    );
    expect(
      sections.map((s) => ({ id: s.id, items: s.items.map((i) => i.moduleId) })),
    ).toMatchInlineSnapshot(`
      [
        {
          "id": "A",
          "items": [
            "customers",
          ],
        },
        {
          "id": "B",
          "items": [
            "programs",
          ],
        },
        {
          "id": "D",
          "items": [
            "employees",
          ],
        },
        {
          "id": "E",
          "items": [
            "create",
          ],
        },
        {
          "id": "F",
          "items": [
            "products",
            "intake",
          ],
        },
        {
          "id": "G",
          "items": [
            "automation",
          ],
        },
      ]
    `);
  });

  it("includes Pack F when packF modules installed", async () => {
    const sections = await buildPlatformSidebar(
      "o1",
      "u1",
      undefined,
      {
        loadInstalledModules: async () => ["products", "intake"],
        loadUserPermissions: async () => ["erp:*"],
      },
    );
    const packF = sections.find((s) => s.id === "F");
    expect(packF).toBeDefined();
    expect(packF!.items.map((i) => i.moduleId).sort()).toEqual([
      "intake",
      "products",
    ]);
  });
});
