/**
 * WI-612 — `createPayrollService` factory + `generateStatement`.
 *
 * The service is unit-tested against a hand-rolled spy delegate that
 * conforms to `PrismaPayrollDelegateLike`. The hermetic setup pins
 * the prisma call args (Prisma calls are a contract the PBC owns —
 * a future schema change must update both sides intentionally) and
 * verifies the round-trip `calculate` → store → `generateStatement`
 * reconstructs the full `PayrollResult`.
 */

import { describe, expect, it, vi } from "vitest";
import {
  createPayrollService,
  type PrismaPayrollDelegateLike,
  type PayrollCreateData,
  type PayrollFindManyWhere,
  type PayrollRow,
  type PayrollResult,
} from "../src/index.js";

function makeDelegate(): {
  delegate: PrismaPayrollDelegateLike;
  rows: PayrollRow[];
  spies: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
} {
  const rows: PayrollRow[] = [];
  let idSeq = 0;
  const create = vi.fn(
    async (args: { data: PayrollCreateData; include?: { items?: boolean } }) => {
      idSeq += 1;
      const id = `pay_${idSeq}`;
      const itemRows = args.data.items.create.map((it) => ({
        category: it.category,
        type: it.type,
        amount: it.amount,
      }));
      const row: PayrollRow = {
        id,
        userId: args.data.userId,
        organizationId: "test_org",
        periodYear: args.data.periodYear,
        periodMonth: args.data.periodMonth,
        gross: args.data.gross,
        net: args.data.net,
        status: args.data.status,
        insuranceRatesYear: args.data.insuranceRatesYear,
        calculatedAt: args.data.calculatedAt,
        items: itemRows,
      };
      rows.push(row);
      return row;
    },
  );
  const findMany = vi.fn(
    async (args: {
      where: PayrollFindManyWhere;
      include?: { items?: boolean };
    }) => {
      return rows.filter(
        (r) =>
          r.userId === args.where.userId &&
          r.periodYear === args.where.periodYear &&
          r.periodMonth === args.where.periodMonth,
      );
    },
  );

  return {
    delegate: { create, findMany },
    rows,
    spies: { create, findMany },
  };
}

const BASE_INPUT = {
  userId: "user_42",
  orgId: "test_org",
  period: { year: 2026, month: 5 } as const,
  employmentType: "FULL_TIME" as const,
  salaryType: "MONTHLY" as const,
  baseSalary: 3_500_000,
} as const;

describe("WI-612 — createPayrollService.calculate", () => {
  it("returns a PayrollResult that satisfies the WI-601 contract", async () => {
    const { delegate } = makeDelegate();
    const service = createPayrollService({ prisma: delegate });

    const result: PayrollResult = await service.calculate({ ...BASE_INPUT });

    expect(result.gross).toBeGreaterThan(0);
    expect(result.net).toBeGreaterThan(0);
    expect(result.net).toBeLessThan(result.gross);
    expect(result.deductions.nationalPension).toBeGreaterThan(0);
    expect(result.deductions.healthInsurance).toBeGreaterThan(0);
    expect(result.metadata.insuranceRatesYear).toBe(2026);
  });

  it("persists a Payroll row + 7 PayrollItem rows on every calculate call", async () => {
    const { delegate, spies, rows } = makeDelegate();
    const service = createPayrollService({ prisma: delegate });

    await service.calculate({ ...BASE_INPUT });

    expect(spies.create).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
    const persisted = rows[0]!;
    expect(persisted.userId).toBe("user_42");
    expect(persisted.periodYear).toBe(2026);
    expect(persisted.periodMonth).toBe(5);
    expect(persisted.status).toBe("CALCULATED");
    expect(persisted.items).toHaveLength(7);
    const types = (persisted.items ?? []).map((it) => it.type).sort();
    expect(types).toEqual(
      [
        "employmentInsurance",
        "healthInsurance",
        "incomeTax",
        "localIncomeTax",
        "longTermCare",
        "nationalPension",
        "other",
      ].sort(),
    );
  });

  it("propagates storage failures (does not swallow create errors)", async () => {
    const failingDelegate: PrismaPayrollDelegateLike = {
      create: vi.fn(async () => {
        throw new Error("simulated prisma create failure");
      }),
      findMany: vi.fn(async () => []),
    };
    const service = createPayrollService({ prisma: failingDelegate });

    await expect(service.calculate({ ...BASE_INPUT })).rejects.toThrow(
      /simulated prisma create failure/,
    );
  });
});

describe("WI-612 — createPayrollService.generateStatement", () => {
  it("reconstructs the full PayrollResult after a calculate round-trip", async () => {
    const { delegate } = makeDelegate();
    const service = createPayrollService({ prisma: delegate });

    const calculated = await service.calculate({
      ...BASE_INPUT,
      overtimeHours: 8,
    });

    const statement = await service.generateStatement({
      userId: "user_42",
      period: { year: 2026, month: 5 },
    });

    expect(statement.result.gross).toBe(calculated.gross);
    expect(statement.result.net).toBe(calculated.net);
    expect(statement.result.deductions).toEqual(calculated.deductions);
    expect(statement.result.metadata.insuranceRatesYear).toBe(
      calculated.metadata.insuranceRatesYear,
    );
    expect(statement.documentUrl).toBeUndefined();
  });

  it("throws when no payroll row exists for (userId, period)", async () => {
    const { delegate } = makeDelegate();
    const service = createPayrollService({ prisma: delegate });

    await expect(
      service.generateStatement({
        userId: "user_does_not_exist",
        period: { year: 2026, month: 1 },
      }),
    ).rejects.toThrow(/no payroll found/);
  });

  it("queries Prisma with include: { items: true } so the deductions can be rebuilt", async () => {
    const { delegate, spies } = makeDelegate();
    const service = createPayrollService({ prisma: delegate });

    await service.calculate({ ...BASE_INPUT });
    await service.generateStatement({
      userId: "user_42",
      period: { year: 2026, month: 5 },
    });

    expect(spies.findMany).toHaveBeenCalledTimes(1);
    const findManyArgs = spies.findMany.mock.calls[0]![0];
    expect(findManyArgs.include).toEqual({ items: true });
    expect(findManyArgs.where).toEqual({
      userId: "user_42",
      periodYear: 2026,
      periodMonth: 5,
    });
  });
});
