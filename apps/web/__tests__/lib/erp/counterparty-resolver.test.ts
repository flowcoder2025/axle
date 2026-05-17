/**
 * Phase 21 WI-723c — counterparty resolver unit tests.
 *
 * The resolver guards the FK that becomes VALID in the same WI: every Order
 * write path now goes through `resolveOrCreateCounterparty` so the
 * `Order.counterpartyId` column is never NULL after this point.
 *
 * Coverage:
 *   - (1) Explicit id path: verifies tenant ownership, RED on mismatch.
 *   - (2) bizRegNo path: canonical form lookup (dashes stripped).
 *   - (3) normalizedName path: only matches when unambiguous; ambiguous
 *     match falls through to create.
 *   - (4) Create fallback: zero matches → fresh ErpCounterparty.
 *   - Name required: empty name → COUNTERPARTY_NAME_REQUIRED (400-class).
 *   - bizRegNo conflict on candidate: differing bizRegNos do NOT match.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@axle/db", () => ({ DB_PACKAGE: "@axle/db", prisma: {} }));

import {
  resolveOrCreateCounterparty,
  CounterpartyResolutionError,
  type CounterpartyTxClient,
} from "../../../lib/erp/counterparty-resolver";

interface CpRow {
  id: string;
  orgId: string;
  normalizedName: string;
  bizRegNo: string | null;
  deletedAt: Date | null;
}

function makeTx({ rows = [] as CpRow[] } = {}) {
  const state = { rows: [...rows], created: [] as Array<Record<string, unknown>> };
  const tx = {
    erpCounterparty: {
      findFirst: vi.fn(async (args: { where: Record<string, unknown> }) => {
        const w = args.where;
        return (
          state.rows.find(
            (r) =>
              (!("id" in w) || r.id === w.id) &&
              (!("orgId" in w) || r.orgId === w.orgId) &&
              (!("bizRegNo" in w) || r.bizRegNo === w.bizRegNo) &&
              (!("deletedAt" in w) || r.deletedAt === w.deletedAt),
          ) ?? null
        );
      }),
      findMany: vi.fn(
        async (args: {
          where: { orgId: string; normalizedName: string; deletedAt: null };
          take?: number;
        }) => {
          const matches = state.rows.filter(
            (r) =>
              r.orgId === args.where.orgId &&
              r.normalizedName === args.where.normalizedName &&
              r.deletedAt === null,
          );
          return args.take ? matches.slice(0, args.take) : matches;
        },
      ),
      create: vi.fn(async (args: { data: Record<string, unknown>; select: unknown }) => {
        const id = `cp_${state.rows.length + 1}`;
        state.created.push(args.data);
        return { id };
      }),
    },
  };
  return { tx: tx as unknown as CounterpartyTxClient, state, raw: tx };
}

const ORG = "org_test";

describe("resolveOrCreateCounterparty", () => {
  it("(1) verifies explicit counterpartyId and returns it when valid", async () => {
    const { tx, raw } = makeTx({
      rows: [
        { id: "cp_known", orgId: ORG, normalizedName: "x", bizRegNo: null, deletedAt: null },
      ],
    });
    const result = await resolveOrCreateCounterparty(tx, {
      orgId: ORG,
      counterpartyId: "cp_known",
      counterpartyName: "Whatever Display",
    });
    expect(result).toEqual({ counterpartyId: "cp_known", created: false, matched: true });
    expect(raw.erpCounterparty.create).not.toHaveBeenCalled();
  });

  it("(1 RED) throws COUNTERPARTY_NOT_IN_TENANT when id is unknown or in another tenant", async () => {
    const { tx } = makeTx();
    await expect(
      resolveOrCreateCounterparty(tx, {
        orgId: ORG,
        counterpartyId: "cp_ghost",
        counterpartyName: "x",
      }),
    ).rejects.toMatchObject({
      name: "CounterpartyResolutionError",
      code: "COUNTERPARTY_NOT_IN_TENANT",
    });
  });

  it("(2) matches by canonical bizRegNo (dashes stripped)", async () => {
    const { tx } = makeTx({
      rows: [
        {
          id: "cp_with_biz",
          orgId: ORG,
          normalizedName: "에이비씨",
          bizRegNo: "1234567890",
          deletedAt: null,
        },
      ],
    });
    const result = await resolveOrCreateCounterparty(tx, {
      orgId: ORG,
      counterpartyName: "(주)에이비씨",
      bizRegNo: "123-45-67890", // dashes canonicalized inside
    });
    expect(result.counterpartyId).toBe("cp_with_biz");
    expect(result.matched).toBe(true);
    expect(result.created).toBe(false);
  });

  it("(3) matches by unambiguous normalizedName when no bizRegNo supplied", async () => {
    const { tx } = makeTx({
      rows: [
        {
          id: "cp_solo",
          orgId: ORG,
          normalizedName: "한솔물류",
          bizRegNo: "9999999999",
          deletedAt: null,
        },
      ],
    });
    const result = await resolveOrCreateCounterparty(tx, {
      orgId: ORG,
      counterpartyName: "주식회사 한솔물류",
    });
    expect(result.counterpartyId).toBe("cp_solo");
    expect(result.matched).toBe(true);
  });

  it("(3 ambiguous) creates a new master when normalizedName has 2+ candidates", async () => {
    const { tx, state } = makeTx({
      rows: [
        { id: "cp_a", orgId: ORG, normalizedName: "abc", bizRegNo: "1111111111", deletedAt: null },
        { id: "cp_b", orgId: ORG, normalizedName: "abc", bizRegNo: "2222222222", deletedAt: null },
      ],
    });
    const result = await resolveOrCreateCounterparty(tx, {
      orgId: ORG,
      counterpartyName: "ABC",
    });
    expect(result.created).toBe(true);
    expect(state.created).toHaveLength(1);
    expect(state.created[0].normalizedName).toBe("abc");
  });

  it("(3 bizReg conflict) does not match when candidate's bizRegNo differs", async () => {
    const { tx, state } = makeTx({
      rows: [
        {
          id: "cp_other",
          orgId: ORG,
          normalizedName: "한솔물류",
          bizRegNo: "1111111111",
          deletedAt: null,
        },
      ],
    });
    const result = await resolveOrCreateCounterparty(tx, {
      orgId: ORG,
      counterpartyName: "한솔물류",
      bizRegNo: "2222222222",
    });
    expect(result.created).toBe(true);
    expect(state.created[0].bizRegNo).toBe("2222222222");
  });

  it("(4) creates a new master with type defaulting to BOTH when nothing matches", async () => {
    const { tx, state } = makeTx();
    const result = await resolveOrCreateCounterparty(tx, {
      orgId: ORG,
      counterpartyName: "(주)신규",
      bizRegNo: "3334445555",
    });
    expect(result.created).toBe(true);
    expect(state.created[0]).toMatchObject({
      orgId: ORG,
      name: "(주)신규",
      normalizedName: "신규",
      bizRegNo: "3334445555",
      type: "BOTH",
    });
  });

  it("(4) respects explicit type override", async () => {
    const { tx, state } = makeTx();
    await resolveOrCreateCounterparty(tx, {
      orgId: ORG,
      counterpartyName: "고객사",
      type: "CUSTOMER",
    });
    expect(state.created[0].type).toBe("CUSTOMER");
  });

  it("(RED) empty counterpartyName → COUNTERPARTY_NAME_REQUIRED", async () => {
    const { tx } = makeTx();
    await expect(
      resolveOrCreateCounterparty(tx, { orgId: ORG, counterpartyName: "   " }),
    ).rejects.toMatchObject({
      name: "CounterpartyResolutionError",
      code: "COUNTERPARTY_NAME_REQUIRED",
    });
  });

  it("ignores soft-deleted candidates (deletedAt != null)", async () => {
    const { tx, state } = makeTx({
      rows: [
        {
          id: "cp_dead",
          orgId: ORG,
          normalizedName: "한솔물류",
          bizRegNo: "1234567890",
          deletedAt: new Date("2026-04-01"),
        },
      ],
    });
    const result = await resolveOrCreateCounterparty(tx, {
      orgId: ORG,
      counterpartyName: "한솔물류",
    });
    expect(result.created).toBe(true);
    expect(state.created).toHaveLength(1);
  });
});
