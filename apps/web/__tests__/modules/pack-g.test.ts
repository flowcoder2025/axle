import { describe, expect, it } from "vitest";
import { packG, packGModules } from "../../src/modules/pack-g-desktop/index.js";

const ALLOWED_SCOPES = new Set([
  "automation:read",
  "certs:read",
  "recording:read",
]);

describe("WI-626 Pack G — Desktop Add-on (3 modules)", () => {
  it("packG declares 3 modules", () => {
    expect(packG.id).toBe("G");
    expect(packG.modules).toHaveLength(3);
  });

  it("packG module ids match the per-module config ids", () => {
    expect(packG.modules).toEqual(packGModules.map((m) => m.id));
  });

  it("every module requires the Desktop Companion", () => {
    for (const m of packGModules) {
      expect(m.requiresDesktop).toBe(true);
    }
  });

  it("multiOrg is false for every module", () => {
    for (const m of packGModules) {
      expect(m.multiOrg).toBe(false);
    }
  });

  it("recording soft-depends on meetings (transcripts integration hint)", () => {
    const recording = packGModules.find((m) => m.id === "recording")!;
    expect(recording.deps.soft).toContain("meetings");
  });

  it("permission scopes are drawn from the documented set", () => {
    for (const mod of packGModules) {
      expect(ALLOWED_SCOPES.has(mod.permission)).toBe(true);
    }
  });
});
