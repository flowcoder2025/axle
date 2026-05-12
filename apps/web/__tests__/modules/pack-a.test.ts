import { describe, expect, it } from "vitest";
import { packA, packAModules } from "../../src/modules/pack-a-business/index.js";

const ALLOWED_SCOPES = new Set([
  "customers:read",
  "projects:read",
  "estimates:read",
  "contracts:read",
  "documents:read",
  "portal:read",
  "calendar:read",
  "meetings:read",
  "finance:read",
  "analytics:read",
]);

describe("WI-622 Pack A — 비즈니스 운영 (10 modules)", () => {
  it("packA declares 10 modules", () => {
    expect(packA.id).toBe("A");
    expect(packA.modules).toHaveLength(10);
    expect(packA.recommended).toBe(true);
  });

  it("packA module ids match the per-module config ids", () => {
    expect(packA.modules).toEqual(packAModules.map((m) => m.id));
  });

  it("every module belongs to packId A", () => {
    for (const mod of packAModules) {
      expect(mod.packId).toBe("A");
    }
  });

  it("hard deps only reference module ids that exist within Pack A", () => {
    const ids = new Set(packAModules.map((m) => m.id));
    for (const mod of packAModules) {
      for (const dep of mod.deps.hard ?? []) {
        expect(ids.has(dep)).toBe(true);
      }
    }
  });

  it("permission scopes are drawn from the documented set", () => {
    for (const mod of packAModules) {
      expect(ALLOWED_SCOPES.has(mod.permission)).toBe(true);
    }
  });

  it("finance + analytics are multiOrg, the others are single-org", () => {
    const multi = packAModules.filter((m) => m.multiOrg).map((m) => m.id).sort();
    expect(multi).toEqual(["analytics", "finance"]);
  });
});
