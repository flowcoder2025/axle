/**
 * `createPayrollService` — factory that composes the synchronous
 * `calculatePayroll` engine with a Prisma-backed payroll store to
 * implement the `PayrollService` surface declared by WI-601's type
 * contract (`src/types.ts`).
 *
 * Surface (WI-612):
 *   - `calculate(input)`: runs `calculatePayroll` and persists the
 *     result + per-deduction `PayrollItem` rows. Returns the result.
 *     Storage failures bubble (the calculation itself stays pure).
 *   - `generateStatement({ userId, period })`: re-reads the persisted
 *     `Payroll` + items for the (userId, period) pair and reconstructs
 *     a `PayrollStatement`. Throws when no row exists.
 *
 * The `deps.prisma` is intentionally a `PrismaPayrollDelegateLike` —
 * a 2-method surface (`create`, `findMany`) — rather than the full
 * `@prisma/client` delegate, so the package builds and tests without
 * dragging in the generated client. Org scoping is done by
 * `createPrismaPayrollStore` (see `prismaStore.ts`) which bakes
 * `organizationId` into the delegate it returns.
 *
 * `deps.ai` is reserved for the labor-advisory chain (`@axle/ai`) that
 * will enrich `generateStatement` with explanatory copy in a follow-up
 * WI — the WI-612 implementation never reads it.
 */

import { calculatePayroll } from "./calculate.js";
import {
  payrollResultToItemsCreate,
  rowToPayrollResult,
  type PrismaPayrollDelegateLike,
} from "./prismaStore.js";
import type {
  PayrollInput,
  PayrollResult,
  PayrollService,
  PayrollStatement,
  YearMonth,
} from "../types.js";

/**
 * Minimal AI client surface tolerated by the service. WI-612 keeps the
 * actual call sites empty; future WIs may consume it to attach
 * explanatory copy. Typed as `unknown`-ish so any future client can be
 * supplied without breaking the WI-612 wiring.
 */
export interface PayrollServiceAiClient {
  // No methods required at WI-612 — left intentionally open.
  readonly [key: string]: unknown;
}

export interface PayrollServiceDeps {
  prisma: PrismaPayrollDelegateLike;
  ai?: PayrollServiceAiClient;
}

/**
 * Strict subtype of the `PayrollService` interface — re-exported so
 * downstream wiring (FlowTeams' `lib/services.ts`) can declare the
 * dependency against the concrete impl when it needs the narrower
 * type.
 */
export type PayrollServiceImpl = PayrollService;

export function createPayrollService(
  deps: PayrollServiceDeps,
): PayrollServiceImpl {
  async function loadResult(
    userId: string,
    period: YearMonth,
  ): Promise<PayrollResult | null> {
    const rows = await deps.prisma.findMany({
      where: {
        userId,
        periodYear: period.year,
        periodMonth: period.month,
      },
      include: { items: true },
    });
    if (rows.length === 0) return null;
    return rowToPayrollResult(rows[0]!);
  }

  return {
    async calculate(input: PayrollInput): Promise<PayrollResult> {
      const result = calculatePayroll(input);
      await deps.prisma.create({
        data: {
          userId: input.userId,
          periodYear: input.period.year,
          periodMonth: input.period.month,
          gross: result.gross,
          net: result.net,
          status: "CALCULATED",
          insuranceRatesYear: result.metadata.insuranceRatesYear,
          calculatedAt: result.metadata.calculatedAt,
          items: { create: payrollResultToItemsCreate(result) },
        },
        include: { items: true },
      });
      return result;
    },

    async generateStatement({
      userId,
      period,
    }: {
      userId: string;
      period: YearMonth;
    }): Promise<PayrollStatement> {
      const result = await loadResult(userId, period);
      if (!result) {
        throw new Error(
          `pbc-hr-payroll.generateStatement: no payroll found for user ${userId} ` +
            `at period ${period.year}-${String(period.month).padStart(2, "0")}.`,
        );
      }
      return { result };
    },
  };
}
