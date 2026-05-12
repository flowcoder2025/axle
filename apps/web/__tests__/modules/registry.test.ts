import { describe, expect, it, beforeEach } from "vitest";
import {
  clearRegistry,
  listModules,
  listPacks,
} from "@axle/core-module-system";
import {
  ALL_MODULES,
  ALL_PACKS,
  registerAllPacks,
  resetPlatformRegistration,
} from "../../src/modules/registry.js";

describe("apps/web platform module registry", () => {
  beforeEach(() => {
    clearRegistry();
    resetPlatformRegistration();
  });

  it("registerAllPacks loads 5 packs and 28 modules", () => {
    registerAllPacks();
    expect(listPacks()).toHaveLength(5);
    expect(listModules()).toHaveLength(28);
  });

  it("ALL_MODULES is the flat concatenation of pack module arrays", () => {
    const totalFromPacks = ALL_PACKS.reduce(
      (sum, p) => sum + p.modules.length,
      0,
    );
    expect(ALL_MODULES).toHaveLength(totalFromPacks);
  });

  it("registerAllPacks is idempotent", () => {
    registerAllPacks();
    registerAllPacks();
    expect(listModules()).toHaveLength(28);
  });

  it("every module id is unique across packs", () => {
    const ids = ALL_MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
