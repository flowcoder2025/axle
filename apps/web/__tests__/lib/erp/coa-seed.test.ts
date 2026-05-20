/**
 * Phase 21 WI-725 — CoA seed constants + seeding function.
 *
 * Contract under test:
 *   1. COA_SEED has >=30 entries spanning all 5 categories (AC #1).
 *   2. Codes are unique within the seed list (no duplicate (orgId,code)
 *      after a seed run).
 *   3. parentCode references point at codes that also exist in the list
 *      so depth-2 / depth-3 rollups in WI-729 don't break on missing
 *      parents.
 *   4. `seedSystemChartOfAccounts` is idempotent — second call inserts 0
 *      and ignores per-row P2002 (race-safe).
 *   5. Source string is the NTS attribution required by audit.
 */

import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@axle/db", () => ({ DB_PACKAGE: "@axle/db", prisma: {} }));

import {
  COA_SEED,
  COA_SOURCE,
  seedSystemChartOfAccounts,
} from "../../../lib/erp/coa-seed";

interface Row {
  id: string;
  orgId: string;
  code: string;
  isSystem: boolean;
}

function makeStub({ rows = [] as Row[], failCodes = [] as string[] } = {}) {
  const state = { rows: [...rows] };
  const tx = {
    chartOfAccounts: {
      count: vi.fn(
        async (args: { where: { orgId: string; isSystem?: boolean } }) =>
          state.rows.filter(
            (r) =>
              r.orgId === args.where.orgId &&
              (args.where.isSystem === undefined || r.isSystem === args.where.isSystem),
          ).length,
      ),
      create: vi.fn(async (args: { data: { orgId: string; code: string; isSystem: boolean } }) => {
        if (failCodes.includes(args.data.code)) {
          // Emit a real P2002 envelope so the seed's catch branch hits.
          const err = new Prisma.PrismaClientKnownRequestError(
            "Unique constraint failed",
            { code: "P2002", clientVersion: "test" },
          );
          throw err;
        }
        if (state.rows.some((r) => r.orgId === args.data.orgId && r.code === args.data.code)) {
          const err = new Prisma.PrismaClientKnownRequestError(
            "Unique constraint failed",
            { code: "P2002", clientVersion: "test" },
          );
          throw err;
        }
        const row: Row = {
          id: `coa_${state.rows.length + 1}`,
          orgId: args.data.orgId,
          code: args.data.code,
          isSystem: args.data.isSystem,
        };
        state.rows.push(row);
        return row;
      }),
    },
  };
  return {
    tx: tx as unknown as Parameters<typeof seedSystemChartOfAccounts>[0],
    state,
    raw: tx,
  };
}

describe("COA_SEED constants", () => {
  it("AC #1 — has 30+ entries", () => {
    expect(COA_SEED.length).toBeGreaterThanOrEqual(30);
  });

  it("spans all 5 categories at least once", () => {
    const categories = new Set(COA_SEED.map((c) => c.category));
    expect(categories.has("REVENUE")).toBe(true);
    expect(categories.has("COGS")).toBe(true);
    expect(categories.has("OPEX")).toBe(true);
    expect(categories.has("NON_OPERATING")).toBe(true);
    expect(categories.has("OTHER")).toBe(true);
  });

  it("codes are unique within the seed list", () => {
    const codes = COA_SEED.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("every parentCode resolves to an existing code in the seed", () => {
    const codes = new Set(COA_SEED.map((c) => c.code));
    for (const row of COA_SEED) {
      if (row.parentCode !== null) {
        expect(codes.has(row.parentCode)).toBe(true);
      }
    }
  });

  it("uses the NTS attribution string", () => {
    expect(COA_SOURCE).toMatch(/국세청\s*표준재무제표/);
  });
});

describe("seedSystemChartOfAccounts", () => {
  it("inserts every seed row with isSystem=true and the NTS source", async () => {
    const { tx, state, raw } = makeStub();
    const result = await seedSystemChartOfAccounts(tx, "org_a");
    expect(result.inserted).toBe(COA_SEED.length);
    expect(result.existed).toBe(0);
    expect(state.rows.every((r) => r.isSystem === true)).toBe(true);

    // Spot-check the data passed to create — every call carries the
    // NTS source string + isSystem flag.
    const calls = raw.chartOfAccounts.create.mock.calls;
    const firstData = calls[0]?.[0]?.data as {
      source?: string;
      isSystem?: boolean;
    } | undefined;
    expect(firstData?.source).toBe(COA_SOURCE);
    expect(firstData?.isSystem).toBe(true);
  });

  it("is idempotent — second call inserts 0", async () => {
    const { tx, state } = makeStub();
    await seedSystemChartOfAccounts(tx, "org_a");
    const result2 = await seedSystemChartOfAccounts(tx, "org_a");
    expect(result2.inserted).toBe(0);
    expect(result2.existed).toBeGreaterThanOrEqual(COA_SEED.length);
    expect(state.rows.filter((r) => r.orgId === "org_a")).toHaveLength(
      COA_SEED.length,
    );
  });

  it("treats per-row P2002 as success (race-safe partial seed)", async () => {
    // Simulate a concurrent seeder that already inserted the 5th row.
    const fail = [COA_SEED[4].code];
    const { tx, state } = makeStub({ failCodes: fail });
    const result = await seedSystemChartOfAccounts(tx, "org_a");
    // The conflicting code is the only skip — everything else lands.
    expect(result.inserted).toBe(COA_SEED.length - 1);
    expect(state.rows).toHaveLength(COA_SEED.length - 1);
  });

  it("scopes by orgId — a separate tenant gets its own seed", async () => {
    const { tx, state } = makeStub();
    await seedSystemChartOfAccounts(tx, "org_a");
    await seedSystemChartOfAccounts(tx, "org_b");
    expect(state.rows.filter((r) => r.orgId === "org_a")).toHaveLength(
      COA_SEED.length,
    );
    expect(state.rows.filter((r) => r.orgId === "org_b")).toHaveLength(
      COA_SEED.length,
    );
  });

  it("skips the per-row loop entirely on the fast path (already-seeded org)", async () => {
    // Pre-populate with a full seed.
    const pre = COA_SEED.map((c, i) => ({
      id: `pre_${i}`,
      orgId: "org_a",
      code: c.code,
      isSystem: true,
    }));
    const { tx, raw } = makeStub({ rows: pre });
    const result = await seedSystemChartOfAccounts(tx, "org_a");
    expect(result.inserted).toBe(0);
    expect(raw.chartOfAccounts.create).not.toHaveBeenCalled();
  });
});
