/**
 * WI-617 — Unit tests for the module catalog source of truth.
 *
 * Renders for the page itself aren't covered here (apps/web has no jsdom +
 * @testing-library/react setup — see __tests__/page.test.tsx and
 * __tests__/components/business-plan-wizard.test.ts for the established
 * pure-logic convention).
 */
import { describe, it, expect } from "vitest";
import {
  PACK_CATALOG,
  PACK_IDS,
  ALL_MODULE_IDS,
  getPack,
  getModule,
  summarize,
  formatPrice,
} from "../../src/lib/module-catalog";

describe("WI-617 — module catalog shape", () => {
  it("exposes exactly 6 packs (A/B/D/E/F/G — wireframes/module-catalog.md)", () => {
    expect(PACK_CATALOG).toHaveLength(6);
    expect(PACK_IDS).toEqual(["A", "B", "D", "E", "F", "G"]);
  });

  it("totals 35 modules across all packs", () => {
    expect(ALL_MODULE_IDS).toHaveLength(35);
  });

  it("has no duplicate module ids across packs", () => {
    const unique = new Set(ALL_MODULE_IDS);
    expect(unique.size).toBe(ALL_MODULE_IDS.length);
  });

  it("Pack A is marked as recommended (default)", () => {
    expect(getPack("A")?.recommended).toBe(true);
  });

  it("only Pack A is recommended", () => {
    const recommendedIds = PACK_CATALOG.filter((p) => p.recommended).map(
      (p) => p.id,
    );
    expect(recommendedIds).toEqual(["A"]);
  });

  it("every pack has at least one module and a positive monthly price", () => {
    for (const pack of PACK_CATALOG) {
      expect(pack.modules.length).toBeGreaterThan(0);
      expect(pack.pricing.monthly).toBeGreaterThan(0);
      expect(pack.title).toMatch(/Pack [ABDEFG]\.|Add-on G\./);
    }
  });

  it("Pack D modules are all multi-org (HR is fully multi-org)", () => {
    const packD = getPack("D")!;
    for (const mod of packD.modules) {
      expect(mod.multiOrg).toBe(true);
    }
  });

  it("Pack E has no multi-org modules (content is single-org only)", () => {
    const packE = getPack("E")!;
    for (const mod of packE.modules) {
      expect(mod.multiOrg).toBe(false);
    }
  });

  it("Pack A has exactly 2 multi-org modules (finance, analytics)", () => {
    const packA = getPack("A")!;
    const multiOrgIds = packA.modules.filter((m) => m.multiOrg).map((m) => m.id);
    expect(multiOrgIds).toEqual(["finance", "analytics"]);
  });

  it("Pack B has 2 multi-org modules (matching, journals)", () => {
    const packB = getPack("B")!;
    const multiOrgIds = packB.modules.filter((m) => m.multiOrg).map((m) => m.id);
    expect(multiOrgIds).toEqual(["matching", "journals"]);
  });

  it("Pack B has 3 admin modules", () => {
    const adminIds = getPack("B")!.modules.filter((m) => m.admin).map((m) => m.id);
    expect(adminIds).toEqual([
      "hwpx-admin",
      "checklist-admin",
      "ai-patterns-admin",
    ]);
  });
});

describe("WI-617 — catalog lookups", () => {
  it("getPack returns the pack by id", () => {
    expect(getPack("A")?.id).toBe("A");
    expect(getPack("ZZ")).toBeUndefined();
  });

  it("getModule walks every pack to locate a module id", () => {
    const result = getModule("payroll");
    expect(result?.pack.id).toBe("D");
    expect(result?.module.label).toBe("급여");
  });

  it("getModule returns undefined for unknown ids", () => {
    expect(getModule("ghost-module")).toBeUndefined();
  });
});

describe("WI-617 — summarize()", () => {
  it("reports zeros for an empty install set", () => {
    const summary = summarize([]);
    expect(summary).toEqual({
      activePackCount: 0,
      activeModuleCount: 0,
      monthlyTotal: 0,
      managedOrgCount: 0,
    });
  });

  it("counts a fully-installed Pack toward activePackCount and monthlyTotal", () => {
    const packA = getPack("A")!;
    const summary = summarize(packA.modules.map((m) => m.id));
    expect(summary.activePackCount).toBe(1);
    expect(summary.monthlyTotal).toBe(packA.pricing.monthly);
    expect(summary.activeModuleCount).toBe(packA.modules.length);
  });

  it("partially-installed pack contributes to activeModuleCount only", () => {
    const summary = summarize(["customers", "projects"]);
    expect(summary.activePackCount).toBe(0);
    expect(summary.activeModuleCount).toBe(2);
    expect(summary.monthlyTotal).toBe(0);
  });

  it("sums monthly cost across multiple fully-installed packs", () => {
    const packA = getPack("A")!;
    const packD = getPack("D")!;
    const allIds = [
      ...packA.modules.map((m) => m.id),
      ...packD.modules.map((m) => m.id),
    ];
    const summary = summarize(allIds);
    expect(summary.activePackCount).toBe(2);
    expect(summary.monthlyTotal).toBe(
      packA.pricing.monthly + packD.pricing.monthly,
    );
  });

  it("managedOrgCount is always 0 in WI-617 (wired up by WI-620)", () => {
    expect(summarize(["payroll", "employees"]).managedOrgCount).toBe(0);
  });
});

describe("WI-617 — formatPrice()", () => {
  it("formats KRW with monthly suffix", () => {
    expect(formatPrice(59_000)).toBe("₩59,000 / 월");
  });

  it("appends pricing notes", () => {
    expect(formatPrice(49_000, "+ 직원 수")).toBe("₩49,000 / 월 + 직원 수");
  });

  it("handles zero gracefully", () => {
    expect(formatPrice(0)).toBe("₩0 / 월");
  });
});
