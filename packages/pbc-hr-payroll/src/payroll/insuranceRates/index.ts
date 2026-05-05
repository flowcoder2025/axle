/**
 * Year-aware lookup for Korean 4대보험 rates.
 *
 * Adding a new year is a 2-line change:
 *   1. drop `<year>.ts` next to this file with a frozen `InsuranceRates`,
 *   2. register it in `RATES_BY_YEAR` below.
 *
 * The lookup is deliberately tolerant on unknown years (returns the
 * nearest-known year rather than throwing) so a payroll calculation
 * never silently 0-deducts on a year boundary; the caller stamps
 * `metadata.insuranceRatesYear` from the returned row, which
 * surfaces the fallback to the consumer.
 */

import type { InsuranceRates } from "../../types.js";
import { KOREAN_INSURANCE_RATES_2025 } from "./2025.js";
import { KOREAN_INSURANCE_RATES_2026 } from "./2026.js";

const RATES_BY_YEAR: ReadonlyMap<number, InsuranceRates> = new Map([
  [KOREAN_INSURANCE_RATES_2025.year, KOREAN_INSURANCE_RATES_2025],
  [KOREAN_INSURANCE_RATES_2026.year, KOREAN_INSURANCE_RATES_2026],
]);

const REGISTERED_YEARS = [...RATES_BY_YEAR.keys()].sort((a, b) => a - b);
const EARLIEST_YEAR = REGISTERED_YEARS[0]!;
const LATEST_YEAR = REGISTERED_YEARS[REGISTERED_YEARS.length - 1]!;

/**
 * Returns the `InsuranceRates` row for the given calendar year. If no
 * exact match is registered the nearest-known year is returned:
 *   - year > latest registered → latest row,
 *   - year < earliest registered → earliest row.
 *
 * Throws on non-finite or non-integer years (caller bug).
 */
export function getInsuranceRatesForYear(year: number): InsuranceRates {
  if (!Number.isInteger(year) || !Number.isFinite(year)) {
    throw new RangeError(
      `getInsuranceRatesForYear: year must be a finite integer, got ${year}`,
    );
  }

  const exact = RATES_BY_YEAR.get(year);
  if (exact) return exact;

  if (year > LATEST_YEAR) {
    return RATES_BY_YEAR.get(LATEST_YEAR)!;
  }
  return RATES_BY_YEAR.get(EARLIEST_YEAR)!;
}

export { KOREAN_INSURANCE_RATES_2025, KOREAN_INSURANCE_RATES_2026 };
