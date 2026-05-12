/**
 * Prisma adapter for the `Payroll` + `PayrollItem` row pair backing
 * `PayrollService.calculate` / `PayrollService.generateStatement`
 * (WI-612).
 *
 * Structurally typed against `PrismaPayrollDelegateLike` so the package
 * doesn't take a hard `@prisma/client` dependency. The consumer wires
 * `prisma.payroll` from @prisma/client; the row shape that backs this
 * adapter lives in `packages/db/prisma/schema.prisma` HR Payroll
 * Domain section (WI-607: `Payroll` + `PayrollItem`).
 *
 * `createPrismaPayrollStore(prismaPayroll, { organizationId })` returns
 * a `PrismaPayrollDelegateLike` with the `organizationId` baked into
 * every `create` / `findMany` call — the same per-org pattern used by
 * `attendance/prismaStore.ts` and `leave/prismaStore.ts`. The service
 * layer therefore stays organization-agnostic and tests can supply a
 * bare delegate without a wrapping organization.
 */

import type { PayrollResult, PayrollStatus } from "../types.js";

/**
 * `Decimal` (or `Decimal`-stringified) numeric fields, normalized to
 * plain `number` by `toNumber` below. `@prisma/client`'s `Decimal`
 * implements `toString()`, so the union covers it without dragging the
 * `@prisma/client` types into this module.
 */
export type DecimalLike = number | string | { toString(): string };

export interface PayrollItemRow {
  category: string;
  type: string;
  amount: DecimalLike;
}

export interface PayrollRow {
  id: string;
  userId: string;
  organizationId: string;
  periodYear: number;
  periodMonth: number;
  gross: DecimalLike;
  net: DecimalLike;
  status: PayrollStatus;
  insuranceRatesYear: number;
  calculatedAt: Date | null;
  paidAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  items?: PayrollItemRow[];
}

export interface PayrollCreateData {
  userId: string;
  periodYear: number;
  periodMonth: number;
  gross: number;
  net: number;
  status: PayrollStatus;
  insuranceRatesYear: number;
  calculatedAt: Date;
  items: { create: PayrollItemRow[] };
}

export interface PayrollFindManyWhere {
  userId: string;
  periodYear: number;
  periodMonth: number;
}

/**
 * Organization-agnostic delegate consumed by `createPayrollService`.
 * Two methods only: `create` and `findMany` (with optional
 * `items` include) — enough to persist a single payroll snapshot per
 * (userId, periodYear, periodMonth) and to retrieve it for statement
 * rendering. The wrapper in `createPrismaPayrollStore` injects
 * `organizationId` on both calls.
 */
export interface PrismaPayrollDelegateLike {
  create(args: {
    data: PayrollCreateData;
    include?: { items?: boolean };
  }): Promise<PayrollRow>;
  findMany(args: {
    where: PayrollFindManyWhere;
    include?: { items?: boolean };
  }): Promise<PayrollRow[]>;
}

/**
 * Raw `prisma.payroll` delegate shape (organization-aware). The
 * consumer passes this to `createPrismaPayrollStore` along with the
 * active `organizationId`; the helper returns a
 * `PrismaPayrollDelegateLike` that pre-fills `organizationId` on every
 * call. The shape is structurally compatible with the @prisma/client
 * delegate generated from the `Payroll` model.
 */
export interface PrismaPayrollRawDelegate {
  create(args: {
    data: PayrollCreateData & { organizationId: string };
    include?: { items?: boolean };
  }): Promise<PayrollRow>;
  findMany(args: {
    where: PayrollFindManyWhere & { organizationId: string };
    include?: { items?: boolean };
  }): Promise<PayrollRow[]>;
}

export interface PrismaPayrollStoreOptions {
  organizationId: string;
}

/**
 * Item categories / types written to `PayrollItem`. The category +
 * type pair is the lookup key in `rowToPayrollResult` so the service
 * can reconstruct the full deduction breakdown from the row.
 */
export const PAYROLL_ITEM_CATEGORY = {
  deduction: "DEDUCTION",
} as const;

export const PAYROLL_ITEM_TYPE = {
  nationalPension: "nationalPension",
  healthInsurance: "healthInsurance",
  longTermCare: "longTermCare",
  employmentInsurance: "employmentInsurance",
  incomeTax: "incomeTax",
  localIncomeTax: "localIncomeTax",
  other: "other",
} as const;

export function toNumber(v: DecimalLike): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  return Number(v.toString());
}

/**
 * Convert a fully-populated `PayrollRow` (with `items` included) back
 * into the `PayrollResult` shape that callers of
 * `PayrollService.generateStatement` expect.
 *
 * Throws when items are missing or the per-deduction lookup keys are
 * absent — both are bugs (the row was written without `items.create`
 * or the consumer forgot `include: { items: true }`).
 */
export function rowToPayrollResult(row: PayrollRow): PayrollResult {
  const items = row.items ?? [];
  const byType = new Map<string, number>();
  for (const item of items) {
    if (item.category === PAYROLL_ITEM_CATEGORY.deduction) {
      byType.set(item.type, toNumber(item.amount));
    }
  }

  function pick(type: string): number {
    const v = byType.get(type);
    if (v === undefined) {
      throw new Error(
        `pbc-hr-payroll.rowToPayrollResult: payroll row ${row.id} is missing deduction item "${type}". ` +
          `Re-query with include: { items: true } or re-run calculate.`,
      );
    }
    return v;
  }

  return {
    gross: toNumber(row.gross),
    deductions: {
      nationalPension: pick(PAYROLL_ITEM_TYPE.nationalPension),
      healthInsurance: pick(PAYROLL_ITEM_TYPE.healthInsurance),
      longTermCare: pick(PAYROLL_ITEM_TYPE.longTermCare),
      employmentInsurance: pick(PAYROLL_ITEM_TYPE.employmentInsurance),
      incomeTax: pick(PAYROLL_ITEM_TYPE.incomeTax),
      localIncomeTax: pick(PAYROLL_ITEM_TYPE.localIncomeTax),
      other: pick(PAYROLL_ITEM_TYPE.other),
    },
    net: toNumber(row.net),
    metadata: {
      insuranceRatesYear: row.insuranceRatesYear,
      calculatedAt: row.calculatedAt ?? new Date(0),
    },
  };
}

/**
 * Convert a `PayrollResult` into the `items.create` payload written
 * alongside the `Payroll` row.
 */
export function payrollResultToItemsCreate(
  result: PayrollResult,
): PayrollItemRow[] {
  return [
    {
      category: PAYROLL_ITEM_CATEGORY.deduction,
      type: PAYROLL_ITEM_TYPE.nationalPension,
      amount: result.deductions.nationalPension,
    },
    {
      category: PAYROLL_ITEM_CATEGORY.deduction,
      type: PAYROLL_ITEM_TYPE.healthInsurance,
      amount: result.deductions.healthInsurance,
    },
    {
      category: PAYROLL_ITEM_CATEGORY.deduction,
      type: PAYROLL_ITEM_TYPE.longTermCare,
      amount: result.deductions.longTermCare,
    },
    {
      category: PAYROLL_ITEM_CATEGORY.deduction,
      type: PAYROLL_ITEM_TYPE.employmentInsurance,
      amount: result.deductions.employmentInsurance,
    },
    {
      category: PAYROLL_ITEM_CATEGORY.deduction,
      type: PAYROLL_ITEM_TYPE.incomeTax,
      amount: result.deductions.incomeTax,
    },
    {
      category: PAYROLL_ITEM_CATEGORY.deduction,
      type: PAYROLL_ITEM_TYPE.localIncomeTax,
      amount: result.deductions.localIncomeTax,
    },
    {
      category: PAYROLL_ITEM_CATEGORY.deduction,
      type: PAYROLL_ITEM_TYPE.other,
      amount: result.deductions.other,
    },
  ];
}

export function createPrismaPayrollStore(
  delegate: PrismaPayrollRawDelegate,
  opts: PrismaPayrollStoreOptions,
): PrismaPayrollDelegateLike {
  return {
    async create({ data, include }) {
      return delegate.create({
        data: { ...data, organizationId: opts.organizationId },
        ...(include !== undefined && { include }),
      });
    },
    async findMany({ where, include }) {
      return delegate.findMany({
        where: { ...where, organizationId: opts.organizationId },
        ...(include !== undefined && { include }),
      });
    },
  };
}
