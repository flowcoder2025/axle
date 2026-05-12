import { describe, expect, it } from "vitest";
import { packD, packDModules } from "../../src/modules/pack-d-hr/index.js";

describe("WI-624 Pack D — HR (5 modules)", () => {
  it("packD declares 5 modules", () => {
    expect(packD.id).toBe("D");
    expect(packD.modules).toHaveLength(5);
    expect(packD.pricing.perUnit).toBeDefined();
  });

  it("packD module ids match the per-module config ids", () => {
    expect(packD.modules).toEqual(packDModules.map((m) => m.id));
  });

  it("every module is multiOrg (HR 위탁 운영 시나리오)", () => {
    for (const m of packDModules) {
      expect(m.multiOrg).toBe(true);
    }
  });

  it("payroll/attendance/leave hard-depend on employees; employees + nomu have no hard deps", () => {
    const byId = new Map(packDModules.map((m) => [m.id, m]));
    for (const id of ["payroll", "attendance", "leave"]) {
      expect(byId.get(id)!.deps.hard).toContain("employees");
    }
    expect(byId.get("employees")!.deps.hard ?? []).toEqual([]);
    expect(byId.get("nomu")!.deps.hard ?? []).toEqual([]);
  });

  it("all modules use the hr:read scope (hierarchical resource)", () => {
    for (const m of packDModules) {
      expect(m.permission).toBe("hr:read");
    }
  });

  it("WI-621 page routes are wired (/payroll, /attendance, /leave, /nomu)", () => {
    const byId = new Map(packDModules.map((m) => [m.id, m]));
    expect(byId.get("payroll")!.route).toBe("/payroll");
    expect(byId.get("attendance")!.route).toBe("/attendance");
    expect(byId.get("leave")!.route).toBe("/leave");
    expect(byId.get("nomu")!.route).toBe("/nomu");
  });
});
