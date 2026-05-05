/**
 * WI-604 — `createAttendanceService` end-to-end (in-memory store).
 *
 * The service composes the per-method verification into a check-in /
 * check-out / summarize flow. Tests use the in-memory store factory
 * (`createInMemoryAttendanceStore`) so the suite is hermetic; the
 * Prisma-backed adapter swap is WI-607.
 */

import { describe, expect, it } from "vitest";
import {
  createAttendanceService,
  createInMemoryAttendanceStore,
  type AttendanceVerificationPolicy,
} from "../../src/index.js";

const POLICY: AttendanceVerificationPolicy = {
  qr: { resolveExpectedCode: (userId: string) => `code-${userId}` },
  ip: { allowedIps: new Set(["10.0.0.1"]) },
  gps: {
    geofences: [{ centerLat: 37.5665, centerLng: 126.978, radiusM: 100 }],
  },
  manual: { allowedApproverIds: new Set(["admin_1"]) },
};

function build(now: Date = new Date("2026-05-15T01:00:00Z")) {
  const store = createInMemoryAttendanceStore();
  const svc = createAttendanceService({
    store,
    policy: POLICY,
    now: () => now,
    schedule: () => ({
      // 09:00 ~ 18:00 KST = 00:00 ~ 09:00 UTC
      startAt: new Date("2026-05-15T00:00:00Z"),
      endAt: new Date("2026-05-15T09:00:00Z"),
    }),
    graceMinutes: 10,
  });
  return { store, svc };
}

describe("WI-604 — createAttendanceService.recordCheckIn", () => {
  it("creates a NORMAL record when the QR code matches and the time is within schedule", async () => {
    const { svc } = build(new Date("2026-05-15T00:05:00Z"));
    const record = await svc.recordCheckIn({
      userId: "u1",
      method: "QR",
      qrCode: "code-u1",
    });
    expect(record.userId).toBe("u1");
    expect(record.method).toBe("QR");
    expect(record.status).toBe("NORMAL");
    expect(record.checkInAt).toEqual(new Date("2026-05-15T00:05:00Z"));
    expect(record.checkOutAt).toBeUndefined();
    expect(record.id).toMatch(/^att_/);
  });

  it("marks the record LATE when check-in is past schedule + grace", async () => {
    // schedule start = 00:00 UTC, grace = 10min, check-in = 00:15 UTC → LATE
    const { svc } = build(new Date("2026-05-15T00:15:00Z"));
    const record = await svc.recordCheckIn({
      userId: "u1",
      method: "QR",
      qrCode: "code-u1",
    });
    expect(record.status).toBe("LATE");
  });

  it("rejects with the verification reason when the QR code mismatches", async () => {
    const { svc } = build();
    await expect(
      svc.recordCheckIn({ userId: "u1", method: "QR", qrCode: "WRONG" }),
    ).rejects.toThrow(/mismatch/i);
  });

  it("rejects when an open check-in already exists (no double-clock)", async () => {
    const { svc } = build();
    await svc.recordCheckIn({ userId: "u1", method: "QR", qrCode: "code-u1" });
    await expect(
      svc.recordCheckIn({ userId: "u1", method: "QR", qrCode: "code-u1" }),
    ).rejects.toThrow(/already checked in/i);
  });

  it("supports IP method with the allow-list", async () => {
    const { svc } = build();
    const record = await svc.recordCheckIn({
      userId: "u1",
      method: "IP",
      ipAddress: "10.0.0.1",
    });
    expect(record.method).toBe("IP");
  });

  it("rejects IP method when the address is off the allow-list", async () => {
    const { svc } = build();
    await expect(
      svc.recordCheckIn({ userId: "u1", method: "IP", ipAddress: "8.8.8.8" }),
    ).rejects.toThrow(/not allowed/i);
  });

  it("supports GPS method within the geofence", async () => {
    const { svc } = build();
    const record = await svc.recordCheckIn({
      userId: "u1",
      method: "GPS",
      coords: { lat: 37.5665, lng: 126.978 },
    });
    expect(record.method).toBe("GPS");
  });

  it("supports MANUAL method when the approver and reason are present", async () => {
    const { svc } = build();
    const record = await svc.recordCheckIn({
      userId: "u1",
      method: "MANUAL",
      manualActorId: "admin_1",
      manualReason: "system outage backfill",
    });
    expect(record.method).toBe("MANUAL");
  });
});

describe("WI-604 — createAttendanceService.recordCheckOut", () => {
  it("closes the open record and computes EARLY_LEAVE when leaving before schedule end", async () => {
    const { svc } = build(new Date("2026-05-15T00:00:00Z"));
    await svc.recordCheckIn({
      userId: "u1",
      method: "QR",
      qrCode: "code-u1",
    });

    // Move clock forward to before scheduled end.
    const { svc: svc2, store } = build(new Date("2026-05-15T05:00:00Z"));
    // Re-attach the same store would be messier; we reuse the first svc
    // instance below with a clock override on the second call.
    void svc2;
    void store;

    const closed = await svc.recordCheckOut({
      userId: "u1",
      now: new Date("2026-05-15T05:00:00Z"),
    });
    expect(closed.checkOutAt).toEqual(new Date("2026-05-15T05:00:00Z"));
    expect(closed.status).toBe("EARLY_LEAVE");
  });

  it("preserves LATE status on check-out (LATE > NORMAL precedence)", async () => {
    const { svc } = build(new Date("2026-05-15T00:30:00Z"));
    await svc.recordCheckIn({
      userId: "u2",
      method: "QR",
      qrCode: "code-u2",
    });
    const closed = await svc.recordCheckOut({
      userId: "u2",
      now: new Date("2026-05-15T09:30:00Z"),
    });
    // LATE on check-in should not be downgraded to NORMAL on check-out.
    expect(closed.status).toBe("LATE");
  });

  it("transitions to NORMAL when check-out is at-or-after schedule end and check-in was on time", async () => {
    const { svc } = build(new Date("2026-05-15T00:00:00Z"));
    await svc.recordCheckIn({
      userId: "u3",
      method: "QR",
      qrCode: "code-u3",
    });
    const closed = await svc.recordCheckOut({
      userId: "u3",
      now: new Date("2026-05-15T09:30:00Z"),
    });
    expect(closed.status).toBe("NORMAL");
  });

  it("rejects when there is no open record", async () => {
    const { svc } = build();
    await expect(svc.recordCheckOut({ userId: "u_unknown" })).rejects.toThrow(
      /no open/i,
    );
  });
});

describe("WI-604 — createAttendanceService.summarize", () => {
  it("aggregates work days / total hours / late / absent over the period", async () => {
    const store = createInMemoryAttendanceStore();
    // Seed three records across May 2026 directly via the store
    // (bypasses the service so we don't have to roll the clock).
    await store.insert({
      id: "att_1",
      userId: "u1",
      checkInAt: new Date("2026-05-01T00:00:00Z"),
      checkOutAt: new Date("2026-05-01T09:00:00Z"),
      method: "QR",
      status: "NORMAL",
    });
    await store.insert({
      id: "att_2",
      userId: "u1",
      checkInAt: new Date("2026-05-02T00:30:00Z"),
      checkOutAt: new Date("2026-05-02T09:00:00Z"),
      method: "QR",
      status: "LATE",
    });
    await store.insert({
      id: "att_3",
      userId: "u1",
      checkInAt: new Date("2026-05-03T00:00:00Z"),
      checkOutAt: new Date("2026-05-03T11:00:00Z"),
      method: "QR",
      status: "NORMAL",
    });
    await store.insert({
      // April record — should NOT be in May summary.
      id: "att_4",
      userId: "u1",
      checkInAt: new Date("2026-04-30T00:00:00Z"),
      checkOutAt: new Date("2026-04-30T09:00:00Z"),
      method: "QR",
      status: "NORMAL",
    });

    const svc = createAttendanceService({
      store,
      policy: POLICY,
    });
    const summary = await svc.summarize({
      userId: "u1",
      period: { year: 2026, month: 5 },
    });

    expect(summary.workDays).toBe(3);
    expect(summary.totalHours).toBeCloseTo(9 + 8.5 + 11, 5);
    // overtime = sum(max(0, daily - 8))
    expect(summary.overtimeHours).toBeCloseTo(1 + 0.5 + 3, 5);
    expect(summary.lateCount).toBe(1);
    expect(summary.absentCount).toBe(0);
    expect(summary.period).toEqual({ year: 2026, month: 5 });
  });

  it("does not double-count an open (still-on-the-clock) record in totalHours", async () => {
    const store = createInMemoryAttendanceStore();
    await store.insert({
      id: "att_open",
      userId: "u1",
      checkInAt: new Date("2026-05-15T00:00:00Z"),
      method: "QR",
      status: "NORMAL",
    });
    const svc = createAttendanceService({ store, policy: POLICY });
    const summary = await svc.summarize({
      userId: "u1",
      period: { year: 2026, month: 5 },
    });
    expect(summary.workDays).toBe(1);
    expect(summary.totalHours).toBe(0);
  });
});

describe("WI-604 — InMemoryAttendanceStore", () => {
  it("findOpenByUser returns null when no records exist", async () => {
    const store = createInMemoryAttendanceStore();
    expect(await store.findOpenByUser("u1")).toBeNull();
  });

  it("findOpenByUser returns the most recent record without checkOutAt", async () => {
    const store = createInMemoryAttendanceStore();
    await store.insert({
      id: "att_1",
      userId: "u1",
      checkInAt: new Date("2026-05-01T00:00:00Z"),
      checkOutAt: new Date("2026-05-01T09:00:00Z"),
      method: "QR",
      status: "NORMAL",
    });
    await store.insert({
      id: "att_2",
      userId: "u1",
      checkInAt: new Date("2026-05-02T00:00:00Z"),
      method: "QR",
      status: "NORMAL",
    });
    const open = await store.findOpenByUser("u1");
    expect(open?.id).toBe("att_2");
  });

  it("update overwrites the existing record by id", async () => {
    const store = createInMemoryAttendanceStore();
    await store.insert({
      id: "att_1",
      userId: "u1",
      checkInAt: new Date("2026-05-01T00:00:00Z"),
      method: "QR",
      status: "NORMAL",
    });
    await store.update({
      id: "att_1",
      userId: "u1",
      checkInAt: new Date("2026-05-01T00:00:00Z"),
      checkOutAt: new Date("2026-05-01T09:00:00Z"),
      method: "QR",
      status: "EARLY_LEAVE",
    });
    const open = await store.findOpenByUser("u1");
    expect(open).toBeNull();
  });

  it("listByUserAndPeriod filters by userId and period", async () => {
    const store = createInMemoryAttendanceStore();
    await store.insert({
      id: "att_a",
      userId: "u1",
      checkInAt: new Date("2026-05-15T00:00:00Z"),
      method: "QR",
      status: "NORMAL",
    });
    await store.insert({
      id: "att_b",
      userId: "u2", // different user
      checkInAt: new Date("2026-05-15T00:00:00Z"),
      method: "QR",
      status: "NORMAL",
    });
    const records = await store.listByUserAndPeriod("u1", {
      year: 2026,
      month: 5,
    });
    expect(records).toHaveLength(1);
    expect(records[0]!.id).toBe("att_a");
  });
});
