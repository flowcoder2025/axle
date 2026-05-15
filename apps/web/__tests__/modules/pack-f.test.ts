import { describe, expect, it } from "vitest";
import { packF, packFModules } from "../../src/modules/pack-f-erp/index.js";

const ALLOWED_SCOPES = new Set(["erp:read", "erp:write"]);
const LIVE_MODULE_IDS = new Set(["products", "inventory", "orders", "intake"]);

describe("WI-701 Pack F — ERP (8 modules)", () => {
  it("packF declares 8 modules", () => {
    expect(packF.id).toBe("F");
    expect(packF.modules).toHaveLength(8);
  });

  it("packF module ids match the per-module config ids", () => {
    expect(packF.modules).toEqual(packFModules.map((m) => m.id));
  });

  it("every module belongs to packId F", () => {
    for (const mod of packFModules) expect(mod.packId).toBe("F");
  });

  it("every module is multiOrg=true (consulting firm scenario)", () => {
    for (const mod of packFModules) expect(mod.multiOrg).toBe(true);
  });

  it("hard deps reference module ids that exist within Pack F", () => {
    const ids = new Set(packFModules.map((m) => m.id));
    for (const mod of packFModules) {
      for (const dep of mod.deps.hard ?? []) expect(ids.has(dep)).toBe(true);
    }
  });

  it("permission scopes are drawn from the documented set", () => {
    for (const mod of packFModules) expect(ALLOWED_SCOPES.has(mod.permission)).toBe(true);
  });

  it("intake uses erp:write (state-changing module)", () => {
    const intake = packFModules.find((m) => m.id === "intake")!;
    expect(intake.permission).toBe("erp:write");
  });

  it("live modules are products/inventory/orders/intake", () => {
    const liveIds = packFModules.filter((m) => LIVE_MODULE_IDS.has(m.id)).map((m) => m.id).sort();
    expect(liveIds).toEqual(["intake", "inventory", "orders", "products"]);
  });
});
