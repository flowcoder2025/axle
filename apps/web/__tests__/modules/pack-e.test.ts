import { describe, expect, it } from "vitest";
import { packE, packEModules } from "../../src/modules/pack-e-content/index.js";

const ALLOWED_SCOPES = new Set(["content:read", "platform:admin"]);

describe("WI-625 Pack E — 콘텐츠 (4 modules)", () => {
  it("packE declares 4 modules", () => {
    expect(packE.id).toBe("E");
    expect(packE.modules).toHaveLength(4);
  });

  it("packE module ids match the per-module config ids", () => {
    expect(packE.modules).toEqual(packEModules.map((m) => m.id));
  });

  it("multiOrg is false for every module (Single-org only)", () => {
    for (const m of packEModules) {
      expect(m.multiOrg).toBe(false);
    }
  });

  it("presets and workflows depend on create", () => {
    const byId = new Map(packEModules.map((m) => [m.id, m]));
    expect(byId.get("presets")!.deps.hard).toContain("create");
    expect(byId.get("workflows")!.deps.hard).toContain("create");
  });

  it("workflows is admin-only with platform:admin scope", () => {
    const wf = packEModules.find((m) => m.id === "workflows")!;
    expect(wf.admin).toBe(true);
    expect(wf.permission).toBe("platform:admin");
  });

  it("permission scopes are drawn from the documented set", () => {
    for (const mod of packEModules) {
      expect(ALLOWED_SCOPES.has(mod.permission)).toBe(true);
    }
  });
});
