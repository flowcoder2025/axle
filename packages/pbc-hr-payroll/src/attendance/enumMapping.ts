/**
 * FlowTeams enum mapping verification.
 *
 * The PBC's `ATTENDANCE_METHODS` / `ATTENDANCE_STATUSES` MUST stay
 * aligned with the FlowTeams Prisma enums of the same name so a
 * `Prisma.$Enums.AttendanceMethod` value can pass through the PBC
 * without translation. WI-607 (FlowTeams → PBC schema port) calls
 * `verifyFlowTeamsAttendanceEnumMapping` at boot to fail-fast if the
 * two sides drift.
 *
 * The FLOWTEAMS_* constants below are the **canonical source-of-truth
 * snapshot** copied from FlowTeams' `prisma/schema.prisma` enums (per
 * docs/specs/meta-platform/pbc-hr-payroll.md §2.1). The PBC's
 * ATTENDANCE_METHODS / ATTENDANCE_STATUSES mirror them exactly; if
 * FlowTeams renames a value, this snapshot must change in the same PR.
 */

import {
  ATTENDANCE_METHODS,
  ATTENDANCE_STATUSES,
  type AttendanceMethod,
  type AttendanceStatus,
} from "../types.js";

export const FLOWTEAMS_ATTENDANCE_METHODS = [
  "QR",
  "IP",
  "GPS",
  "MANUAL",
] as const satisfies ReadonlyArray<AttendanceMethod>;

export const FLOWTEAMS_ATTENDANCE_STATUSES = [
  "NORMAL",
  "LATE",
  "EARLY_LEAVE",
  "ABSENT",
] as const satisfies ReadonlyArray<AttendanceStatus>;

export interface EnumMismatch {
  field: "methods" | "statuses";
  /** Values present in FlowTeams but not in the PBC. */
  missing: string[];
  /** Values present in the PBC but not in FlowTeams. */
  extra: string[];
}

export type EnumMappingResult =
  | { ok: true }
  | { ok: false; mismatches: EnumMismatch[] };

function diff(
  field: "methods" | "statuses",
  pbc: ReadonlyArray<string>,
  flowteams: ReadonlyArray<string>,
): EnumMismatch | null {
  const pbcSet = new Set(pbc);
  const ftSet = new Set(flowteams);
  const missing = flowteams.filter((v) => !pbcSet.has(v));
  const extra = pbc.filter((v) => !ftSet.has(v));
  if (missing.length === 0 && extra.length === 0) return null;
  return { field, missing, extra };
}

export function verifyFlowTeamsAttendanceEnumMapping(input: {
  pbcMethods: ReadonlyArray<string>;
  pbcStatuses: ReadonlyArray<string>;
  flowteamsMethods: ReadonlyArray<string>;
  flowteamsStatuses: ReadonlyArray<string>;
}): EnumMappingResult {
  const mismatches: EnumMismatch[] = [];
  const m = diff("methods", input.pbcMethods, input.flowteamsMethods);
  if (m) mismatches.push(m);
  const s = diff("statuses", input.pbcStatuses, input.flowteamsStatuses);
  if (s) mismatches.push(s);
  if (mismatches.length === 0) return { ok: true };
  return { ok: false, mismatches };
}

/**
 * Convenience wrapper used at startup: verifies the PBC's exported
 * enums against the FlowTeams snapshot, no arguments required.
 */
export function verifyDefaultFlowTeamsAttendanceEnumMapping(): EnumMappingResult {
  return verifyFlowTeamsAttendanceEnumMapping({
    pbcMethods: ATTENDANCE_METHODS,
    pbcStatuses: ATTENDANCE_STATUSES,
    flowteamsMethods: FLOWTEAMS_ATTENDANCE_METHODS,
    flowteamsStatuses: FLOWTEAMS_ATTENDANCE_STATUSES,
  });
}
