/**
 * WI-605 — Korean leave allocation policy.
 *
 * `createKoreanLeavePolicy` encodes the Korean Labor Standards Act
 * baseline; an org-specific policy can replace it via the
 * `createLeaveService` factory. Tests pin the rules so a regulation
 * change forces the maintainer to update both sides at once.
 */

import { describe, expect, it } from "vitest";
import { createKoreanLeavePolicy } from "../../src/index.js";

describe("WI-605 — createKoreanLeavePolicy.resolveAnnualGrant", () => {
  const policy = createKoreanLeavePolicy();

  it("grants up to 11 days for tenure < 1 year (월 1개씩)", () => {
    expect(
      policy.resolveAnnualGrant({ userId: "u", year: 2026, tenureYears: 0 }),
    ).toBe(11);
  });

  it("grants 15 days at exactly 1 year of service", () => {
    expect(
      policy.resolveAnnualGrant({ userId: "u", year: 2026, tenureYears: 1 }),
    ).toBe(15);
  });

  it("adds 1 day every 2 years past the first (3y → 16, 5y → 17, 21y → 25 cap)", () => {
    expect(
      policy.resolveAnnualGrant({ userId: "u", year: 2026, tenureYears: 3 }),
    ).toBe(16);
    expect(
      policy.resolveAnnualGrant({ userId: "u", year: 2026, tenureYears: 5 }),
    ).toBe(17);
    expect(
      policy.resolveAnnualGrant({ userId: "u", year: 2026, tenureYears: 21 }),
    ).toBe(25); // cap
    expect(
      policy.resolveAnnualGrant({ userId: "u", year: 2026, tenureYears: 40 }),
    ).toBe(25); // still capped
  });
});

describe("WI-605 — createKoreanLeavePolicy.resolveOtherGrant (per LeaveType)", () => {
  const policy = createKoreanLeavePolicy();

  it("MATERNITY = 90 days (출산휴가)", () => {
    expect(policy.resolveOtherGrant("MATERNITY", 2026)).toBe(90);
  });

  it("PATERNITY = 10 days (배우자 출산휴가, 2026 기준)", () => {
    expect(policy.resolveOtherGrant("PATERNITY", 2026)).toBe(10);
  });

  it("CONDOLENCE = 5 days (경조사, 기본 정책)", () => {
    expect(policy.resolveOtherGrant("CONDOLENCE", 2026)).toBe(5);
  });

  it("SICK = 0 days (statutory unpaid; org may override)", () => {
    expect(policy.resolveOtherGrant("SICK", 2026)).toBe(0);
  });

  it("OTHER = 0 days (org-specific only)", () => {
    expect(policy.resolveOtherGrant("OTHER", 2026)).toBe(0);
  });

  it("ANNUAL is not handled here — caller routes to resolveAnnualGrant", () => {
    expect(policy.resolveOtherGrant("ANNUAL", 2026)).toBe(0);
  });
});
