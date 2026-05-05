/**
 * WI-605 — `createLeaveService` end-to-end (in-memory store).
 *
 * Covers the LeaveService surface from WI-601 (request / approve /
 * reject / balance) plus the per-LeaveType balance accounting that the
 * WI title calls out.
 */

import { describe, expect, it } from "vitest";
import {
  createInMemoryLeaveStore,
  createKoreanLeavePolicy,
  createLeaveService,
  countLeaveDays,
  type LeaveServiceImpl,
} from "../../src/index.js";

function build(opts: { tenureYears?: number } = {}): {
  svc: LeaveServiceImpl;
  store: ReturnType<typeof createInMemoryLeaveStore>;
} {
  const store = createInMemoryLeaveStore();
  const svc = createLeaveService({
    store,
    policy: createKoreanLeavePolicy(),
    resolveTenureYears: () => opts.tenureYears ?? 3, // default 3y → 16일 연차
    now: () => new Date("2026-05-15T00:00:00Z"),
  });
  return { svc, store };
}

describe("WI-605 — countLeaveDays (inclusive calendar days)", () => {
  it("single-day request counts 1 day", () => {
    expect(
      countLeaveDays(new Date("2026-06-01"), new Date("2026-06-01")),
    ).toBe(1);
  });

  it("3-day span counts 3 days", () => {
    expect(
      countLeaveDays(new Date("2026-06-01"), new Date("2026-06-03")),
    ).toBe(3);
  });

  it("crosses month boundary correctly", () => {
    expect(
      countLeaveDays(new Date("2026-06-29"), new Date("2026-07-02")),
    ).toBe(4);
  });

  it("rejects endDate < startDate", () => {
    expect(() =>
      countLeaveDays(new Date("2026-06-05"), new Date("2026-06-01")),
    ).toThrow(/end/i);
  });
});

describe("WI-605 — leaveService.request", () => {
  it("creates a PENDING leave with the computed day count", async () => {
    const { svc, store } = build();
    const r = await svc.request({
      userId: "u1",
      type: "ANNUAL",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-06-03"),
      reason: "휴식",
    });
    expect(r.status).toBe("PENDING");
    expect(r.id).toMatch(/^lv_/);
    const stored = await store.findById(r.id);
    expect(stored?.status).toBe("PENDING");
    expect(stored?.days).toBe(3);
    expect(stored?.type).toBe("ANNUAL");
  });

  it("rejects when endDate < startDate", async () => {
    const { svc } = build();
    await expect(
      svc.request({
        userId: "u1",
        type: "ANNUAL",
        startDate: new Date("2026-06-05"),
        endDate: new Date("2026-06-01"),
      }),
    ).rejects.toThrow(/end/i);
  });

  it("rejects when an APPROVED leave already overlaps the same date range", async () => {
    const { svc, store } = build();
    await store.insert({
      id: "lv_existing",
      userId: "u1",
      type: "ANNUAL",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-06-05"),
      days: 5,
      status: "APPROVED",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(
      svc.request({
        userId: "u1",
        type: "ANNUAL",
        startDate: new Date("2026-06-03"),
        endDate: new Date("2026-06-04"),
      }),
    ).rejects.toThrow(/overlap/i);
  });
});

describe("WI-605 — leaveService.approve / reject", () => {
  it("PENDING → APPROVED stamps the approverId", async () => {
    const { svc, store } = build();
    const r = await svc.request({
      userId: "u1",
      type: "ANNUAL",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-06-01"),
    });
    await svc.approve({ leaveId: r.id, approverId: "manager_1" });
    const after = await store.findById(r.id);
    expect(after?.status).toBe("APPROVED");
    expect(after?.approverId).toBe("manager_1");
  });

  it("PENDING → REJECTED stamps the rejection reason", async () => {
    const { svc, store } = build();
    const r = await svc.request({
      userId: "u1",
      type: "ANNUAL",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-06-01"),
    });
    await svc.reject({
      leaveId: r.id,
      approverId: "manager_1",
      reason: "팀 일정 충돌",
    });
    const after = await store.findById(r.id);
    expect(after?.status).toBe("REJECTED");
    expect(after?.rejectionReason).toBe("팀 일정 충돌");
  });

  it("approve refuses a non-PENDING leave (already APPROVED)", async () => {
    const { svc } = build();
    const r = await svc.request({
      userId: "u1",
      type: "ANNUAL",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-06-01"),
    });
    await svc.approve({ leaveId: r.id, approverId: "m" });
    await expect(
      svc.approve({ leaveId: r.id, approverId: "m" }),
    ).rejects.toThrow(/PENDING/);
  });

  it("reject requires a non-empty reason", async () => {
    const { svc } = build();
    const r = await svc.request({
      userId: "u1",
      type: "ANNUAL",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-06-01"),
    });
    await expect(
      svc.reject({ leaveId: r.id, approverId: "m", reason: "" }),
    ).rejects.toThrow(/reason/i);
  });

  it("approve / reject throw when leaveId is unknown", async () => {
    const { svc } = build();
    await expect(
      svc.approve({ leaveId: "lv_missing", approverId: "m" }),
    ).rejects.toThrow(/not found/i);
    await expect(
      svc.reject({ leaveId: "lv_missing", approverId: "m", reason: "x" }),
    ).rejects.toThrow(/not found/i);
  });
});

describe("WI-605 — leaveService.balance (per-LeaveType accounting)", () => {
  it("returns the policy-granted annual count and zero usage when no leaves exist", async () => {
    const { svc } = build({ tenureYears: 3 }); // 16 days
    const b = await svc.balance({ userId: "u1", year: 2026 });
    expect(b.granted).toBe(16);
    expect(b.used).toBe(0);
    expect(b.remaining).toBe(16);
    expect(b.byType).toEqual({
      ANNUAL: 0,
      SICK: 0,
      CONDOLENCE: 0,
      MATERNITY: 0,
      PATERNITY: 0,
      OTHER: 0,
    });
  });

  it("counts only APPROVED leaves toward used / byType (PENDING and REJECTED ignored)", async () => {
    const { svc, store } = build({ tenureYears: 3 });
    await store.insert({
      id: "lv_a",
      userId: "u1",
      type: "ANNUAL",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-06-03"),
      days: 3,
      status: "APPROVED",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await store.insert({
      id: "lv_p",
      userId: "u1",
      type: "ANNUAL",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-02"),
      days: 2,
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await store.insert({
      id: "lv_r",
      userId: "u1",
      type: "ANNUAL",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-05"),
      days: 5,
      status: "REJECTED",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const b = await svc.balance({ userId: "u1", year: 2026 });
    expect(b.used).toBe(3);
    expect(b.byType.ANNUAL).toBe(3);
    expect(b.remaining).toBe(13);
  });

  it("breaks down usage per LeaveType (SICK / MATERNITY / PATERNITY / etc.)", async () => {
    const { svc, store } = build({ tenureYears: 3 });
    const seed = (
      id: string,
      type:
        | "ANNUAL"
        | "SICK"
        | "CONDOLENCE"
        | "MATERNITY"
        | "PATERNITY"
        | "OTHER",
      days: number,
    ) =>
      store.insert({
        id,
        userId: "u1",
        type,
        startDate: new Date("2026-06-01"),
        endDate: new Date(2026, 5, days),
        days,
        status: "APPROVED",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    await seed("lv_a", "ANNUAL", 2);
    await seed("lv_s", "SICK", 1);
    await seed("lv_c", "CONDOLENCE", 3);
    await seed("lv_m", "MATERNITY", 90);
    await seed("lv_p", "PATERNITY", 10);
    await seed("lv_o", "OTHER", 4);

    const b = await svc.balance({ userId: "u1", year: 2026 });
    expect(b.byType).toEqual({
      ANNUAL: 2,
      SICK: 1,
      CONDOLENCE: 3,
      MATERNITY: 90,
      PATERNITY: 10,
      OTHER: 4,
    });
    // `used` / `remaining` reflect ANNUAL only (statutory tracking).
    expect(b.used).toBe(2);
    expect(b.remaining).toBe(14);
  });

  it("clamps remaining at 0 when used exceeds granted (over-borrowed leave)", async () => {
    const { svc, store } = build({ tenureYears: 0 }); // 11 days
    await store.insert({
      id: "lv_over",
      userId: "u1",
      type: "ANNUAL",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-06-15"),
      days: 15,
      status: "APPROVED",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const b = await svc.balance({ userId: "u1", year: 2026 });
    expect(b.granted).toBe(11);
    expect(b.used).toBe(15);
    expect(b.remaining).toBe(0);
  });

  it("filters out leaves from a different year", async () => {
    const { svc, store } = build({ tenureYears: 3 });
    await store.insert({
      id: "lv_25",
      userId: "u1",
      type: "ANNUAL",
      startDate: new Date("2025-12-29"),
      endDate: new Date("2025-12-31"),
      days: 3,
      status: "APPROVED",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const b = await svc.balance({ userId: "u1", year: 2026 });
    expect(b.used).toBe(0);
  });
});

describe("WI-605 — InMemoryLeaveStore", () => {
  it("findById returns null when no record", async () => {
    const store = createInMemoryLeaveStore();
    expect(await store.findById("lv_x")).toBeNull();
  });

  it("update overwrites by id", async () => {
    const store = createInMemoryLeaveStore();
    await store.insert({
      id: "lv_1",
      userId: "u1",
      type: "ANNUAL",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-06-01"),
      days: 1,
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await store.update({
      id: "lv_1",
      userId: "u1",
      type: "ANNUAL",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-06-01"),
      days: 1,
      status: "APPROVED",
      approverId: "m",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect((await store.findById("lv_1"))?.status).toBe("APPROVED");
  });

  it("listByUserAndYear filters by user + the leave's startDate year", async () => {
    const store = createInMemoryLeaveStore();
    const base = {
      userId: "u1",
      type: "ANNUAL" as const,
      days: 1,
      status: "APPROVED" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await store.insert({
      ...base,
      id: "lv_2025",
      startDate: new Date("2025-06-01"),
      endDate: new Date("2025-06-01"),
    });
    await store.insert({
      ...base,
      id: "lv_2026",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-06-01"),
    });
    const records = await store.listByUserAndYear("u1", 2026);
    expect(records.map((r) => r.id)).toEqual(["lv_2026"]);
  });
});
