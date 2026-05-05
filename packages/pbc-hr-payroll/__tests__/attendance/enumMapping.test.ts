/**
 * WI-604 — FlowTeams enum mapping verification.
 *
 * The FlowTeams app (the consumer that this PBC will replace via
 * WI-607/608) declares its own Prisma enums for `AttendanceMethod` and
 * `AttendanceStatus`. The PBC mirrors those values so a `Prisma.$Enums`
 * value can flow into and out of the service without translation.
 *
 * `verifyFlowTeamsAttendanceEnumMapping(...)` lets WI-607 (which moves
 * the schema into the PBC) assert at startup that the source-of-truth
 * arrays match. The test below pins the canonical values so a typo on
 * either side fails this suite immediately.
 */

import { describe, expect, it } from "vitest";
import {
  ATTENDANCE_METHODS,
  ATTENDANCE_STATUSES,
  FLOWTEAMS_ATTENDANCE_METHODS,
  FLOWTEAMS_ATTENDANCE_STATUSES,
  verifyFlowTeamsAttendanceEnumMapping,
} from "../../src/index.js";

describe("WI-604 — FlowTeams source-of-truth enum constants", () => {
  it("FLOWTEAMS_ATTENDANCE_METHODS = QR / IP / GPS / MANUAL", () => {
    expect([...FLOWTEAMS_ATTENDANCE_METHODS]).toEqual([
      "QR",
      "IP",
      "GPS",
      "MANUAL",
    ]);
  });

  it("FLOWTEAMS_ATTENDANCE_STATUSES = NORMAL / LATE / EARLY_LEAVE / ABSENT", () => {
    expect([...FLOWTEAMS_ATTENDANCE_STATUSES]).toEqual([
      "NORMAL",
      "LATE",
      "EARLY_LEAVE",
      "ABSENT",
    ]);
  });
});

describe("WI-604 — PBC enums mirror the FlowTeams source", () => {
  it("ATTENDANCE_METHODS matches FLOWTEAMS_ATTENDANCE_METHODS exactly", () => {
    expect([...ATTENDANCE_METHODS]).toEqual([...FLOWTEAMS_ATTENDANCE_METHODS]);
  });

  it("ATTENDANCE_STATUSES matches FLOWTEAMS_ATTENDANCE_STATUSES exactly", () => {
    expect([...ATTENDANCE_STATUSES]).toEqual([
      ...FLOWTEAMS_ATTENDANCE_STATUSES,
    ]);
  });
});

describe("WI-604 — verifyFlowTeamsAttendanceEnumMapping", () => {
  it("returns ok=true when both PBC and FlowTeams enums match the canonical lists", () => {
    const r = verifyFlowTeamsAttendanceEnumMapping({
      pbcMethods: ATTENDANCE_METHODS,
      pbcStatuses: ATTENDANCE_STATUSES,
      flowteamsMethods: FLOWTEAMS_ATTENDANCE_METHODS,
      flowteamsStatuses: FLOWTEAMS_ATTENDANCE_STATUSES,
    });
    expect(r.ok).toBe(true);
  });

  it("returns ok=false with the diff when methods diverge", () => {
    const r = verifyFlowTeamsAttendanceEnumMapping({
      pbcMethods: ["QR", "IP", "GPS"], // missing MANUAL
      pbcStatuses: ATTENDANCE_STATUSES,
      flowteamsMethods: FLOWTEAMS_ATTENDANCE_METHODS,
      flowteamsStatuses: FLOWTEAMS_ATTENDANCE_STATUSES,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.mismatches).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "methods" }),
        ]),
      );
      expect(r.mismatches[0]!.missing).toContain("MANUAL");
    }
  });

  it("returns ok=false with the diff when statuses diverge", () => {
    const r = verifyFlowTeamsAttendanceEnumMapping({
      pbcMethods: ATTENDANCE_METHODS,
      pbcStatuses: ["NORMAL", "LATE"], // missing EARLY_LEAVE / ABSENT
      flowteamsMethods: FLOWTEAMS_ATTENDANCE_METHODS,
      flowteamsStatuses: FLOWTEAMS_ATTENDANCE_STATUSES,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const statusEntry = r.mismatches.find((m) => m.field === "statuses");
      expect(statusEntry?.missing).toEqual(
        expect.arrayContaining(["EARLY_LEAVE", "ABSENT"]),
      );
    }
  });

  it("flags extras (PBC declares a value FlowTeams doesn't)", () => {
    const r = verifyFlowTeamsAttendanceEnumMapping({
      pbcMethods: ["QR", "IP", "GPS", "MANUAL", "BIOMETRIC" as never],
      pbcStatuses: ATTENDANCE_STATUSES,
      flowteamsMethods: FLOWTEAMS_ATTENDANCE_METHODS,
      flowteamsStatuses: FLOWTEAMS_ATTENDANCE_STATUSES,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.mismatches[0]!.extra).toContain("BIOMETRIC");
    }
  });
});
