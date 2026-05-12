import { beforeEach, describe, expect, it } from "vitest";
import {
  checkDependencies,
  findDependents,
  topologicalSort,
} from "../src/index.js";
import { seedRegistry } from "./fixtures.js";

describe("WI-616 — dependencies", () => {
  beforeEach(() => {
    seedRegistry();
  });

  describe("checkDependencies", () => {
    it("passes when module has no hard deps", () => {
      expect(checkDependencies("customers", new Set())).toEqual({
        ok: true,
        missing: [],
      });
    });

    it("fails when hard dep is not installed", () => {
      expect(checkDependencies("payroll", new Set())).toEqual({
        ok: false,
        missing: ["employees"],
      });
    });

    it("passes when hard dep is installed", () => {
      expect(checkDependencies("payroll", new Set(["employees"]))).toEqual({
        ok: true,
        missing: [],
      });
    });

    it("ignores soft deps", () => {
      // estimates has soft:["customers"] but no hard deps
      expect(checkDependencies("estimates", new Set())).toEqual({
        ok: true,
        missing: [],
      });
    });

    it("throws on unknown module id", () => {
      expect(() => checkDependencies("ghost", new Set())).toThrow(
        /Unknown module/,
      );
    });
  });

  describe("topologicalSort", () => {
    it("orders dependents after their hard deps", () => {
      const sorted = topologicalSort(["payroll", "employees"]);
      expect(sorted.indexOf("employees")).toBeLessThan(sorted.indexOf("payroll"));
    });

    it("handles a chain of three dependencies", () => {
      // hwpx-admin (hard: programs) — install programs first
      const sorted = topologicalSort(["hwpx-admin", "matching", "programs"]);
      expect(sorted.indexOf("programs")).toBeLessThan(sorted.indexOf("matching"));
      expect(sorted.indexOf("programs")).toBeLessThan(
        sorted.indexOf("hwpx-admin"),
      );
    });

    it("returns independent modules in deterministic alphabetical order", () => {
      const sorted = topologicalSort(["projects", "customers"]);
      expect(sorted).toEqual(["customers", "projects"]);
    });

    it("drops unknown ids silently", () => {
      const sorted = topologicalSort(["ghost", "customers"]);
      expect(sorted).toEqual(["customers"]);
    });
  });

  describe("findDependents", () => {
    it("returns modules whose hard deps include the given id", () => {
      expect(findDependents("employees")).toEqual(["payroll"]);
      expect(findDependents("programs")).toEqual(["hwpx-admin", "matching"]);
    });

    it("returns empty array when nothing depends on it", () => {
      expect(findDependents("finance")).toEqual([]);
    });

    it("ignores soft deps", () => {
      // estimates has soft:["customers"] — customers should NOT show estimates as dependent
      expect(findDependents("customers")).toEqual([]);
    });
  });
});
