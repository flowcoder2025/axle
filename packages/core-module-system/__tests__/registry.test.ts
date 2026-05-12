import { beforeEach, describe, expect, it } from "vitest";
import {
  clearRegistry,
  getModule,
  getPack,
  listModules,
  listPacks,
  registerModule,
  registerPack,
} from "../src/index.js";
import {
  MOD_CUSTOMERS,
  MOD_PAYROLL,
  MOD_PROJECTS,
  PACK_A,
  PACK_D,
  seedRegistry,
} from "./fixtures.js";

describe("WI-616 — registry", () => {
  beforeEach(() => {
    clearRegistry();
  });

  it("registers and retrieves a module", () => {
    registerModule(MOD_CUSTOMERS);
    expect(getModule("customers")).toEqual(MOD_CUSTOMERS);
  });

  it("registers and retrieves a pack", () => {
    registerPack(PACK_A);
    expect(getPack("A")).toEqual(PACK_A);
  });

  it("returns undefined for unknown ids", () => {
    expect(getModule("nope")).toBeUndefined();
    expect(getPack("ZZ")).toBeUndefined();
  });

  it("lists registered modules in insertion order", () => {
    registerModule(MOD_CUSTOMERS);
    registerModule(MOD_PROJECTS);
    registerModule(MOD_PAYROLL);
    expect(listModules().map((m) => m.id)).toEqual([
      "customers",
      "projects",
      "payroll",
    ]);
  });

  it("lists registered packs", () => {
    registerPack(PACK_A);
    registerPack(PACK_D);
    expect(listPacks().map((p) => p.id).sort()).toEqual(["A", "D"]);
  });

  it("overwrites a module when registered with the same id", () => {
    registerModule(MOD_CUSTOMERS);
    const overridden = { ...MOD_CUSTOMERS, label: "Clients" };
    registerModule(overridden);
    expect(getModule("customers")?.label).toBe("Clients");
    expect(listModules()).toHaveLength(1);
  });

  it("throws when registering a module without id", () => {
    expect(() =>
      registerModule({ ...MOD_CUSTOMERS, id: "" }),
    ).toThrow(/id is required/);
  });

  it("throws when registering a module without packId", () => {
    expect(() =>
      registerModule({ ...MOD_CUSTOMERS, packId: "" }),
    ).toThrow(/packId is required/);
  });

  it("throws when registering a pack without id", () => {
    expect(() => registerPack({ ...PACK_A, id: "" })).toThrow(/id is required/);
  });

  it("clearRegistry wipes both module and pack catalogs", () => {
    seedRegistry();
    expect(listModules().length).toBeGreaterThan(0);
    expect(listPacks().length).toBeGreaterThan(0);
    clearRegistry();
    expect(listModules()).toEqual([]);
    expect(listPacks()).toEqual([]);
  });
});
