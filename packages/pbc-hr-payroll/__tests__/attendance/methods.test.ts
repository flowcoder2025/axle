/**
 * WI-604 — per-AttendanceMethod context verification.
 *
 * Each method has its own verification surface; the service composes
 * these into the check-in flow. Tests pin both the happy path and the
 * specific failure reason (so callers can render a useful UX message
 * instead of "verification failed").
 */

import { describe, expect, it } from "vitest";
import {
  verifyAttendanceContext,
  verifyGpsAttendance,
  verifyIpAttendance,
  verifyManualAttendance,
  verifyQrAttendance,
} from "../../src/index.js";

describe("WI-604 — verifyQrAttendance", () => {
  it("accepts when the submitted code matches the resolved expected code", () => {
    const result = verifyQrAttendance({
      submittedCode: "ABC-123",
      expectedCode: "ABC-123",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects when the submitted code is missing", () => {
    const result = verifyQrAttendance({
      submittedCode: undefined,
      expectedCode: "ABC-123",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/missing/i);
  });

  it("rejects when no expected code is registered for the user", () => {
    const result = verifyQrAttendance({
      submittedCode: "ABC-123",
      expectedCode: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/not registered/i);
  });

  it("rejects when the codes differ", () => {
    const result = verifyQrAttendance({
      submittedCode: "WRONG",
      expectedCode: "ABC-123",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/mismatch/i);
  });
});

describe("WI-604 — verifyIpAttendance", () => {
  const allowed = new Set(["10.0.0.1", "192.168.1.10"]);

  it("accepts an exact IP match against the allow-list", () => {
    expect(verifyIpAttendance({ ip: "10.0.0.1", allowedIps: allowed }).ok).toBe(
      true,
    );
  });

  it("rejects an IP not on the allow-list", () => {
    const r = verifyIpAttendance({ ip: "10.0.0.99", allowedIps: allowed });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/not allowed/i);
  });

  it("rejects when the IP is missing or empty", () => {
    expect(
      verifyIpAttendance({ ip: undefined, allowedIps: allowed }).ok,
    ).toBe(false);
    expect(verifyIpAttendance({ ip: "", allowedIps: allowed }).ok).toBe(false);
  });

  it("rejects when the allow-list is empty (defensive default)", () => {
    const r = verifyIpAttendance({
      ip: "10.0.0.1",
      allowedIps: new Set<string>(),
    });
    expect(r.ok).toBe(false);
  });
});

describe("WI-604 — verifyGpsAttendance (haversine within geofence)", () => {
  const seoulCityHall = { centerLat: 37.5665, centerLng: 126.978, radiusM: 100 };

  it("accepts a point at the geofence center", () => {
    const r = verifyGpsAttendance({
      coords: { lat: 37.5665, lng: 126.978 },
      geofences: [seoulCityHall],
    });
    expect(r.ok).toBe(true);
  });

  it("accepts a point just inside the radius (~50m north)", () => {
    // 0.00045° latitude ≈ 50m
    const r = verifyGpsAttendance({
      coords: { lat: 37.56695, lng: 126.978 },
      geofences: [seoulCityHall],
    });
    expect(r.ok).toBe(true);
  });

  it("rejects a point ~500m away from every geofence", () => {
    // 0.005° latitude ≈ 555m
    const r = verifyGpsAttendance({
      coords: { lat: 37.5715, lng: 126.978 },
      geofences: [seoulCityHall],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/outside|geofence/i);
  });

  it("accepts when at least one of multiple geofences contains the point", () => {
    const gangnam = {
      centerLat: 37.4979,
      centerLng: 127.0276,
      radiusM: 200,
    };
    const r = verifyGpsAttendance({
      coords: { lat: 37.498, lng: 127.0277 },
      geofences: [seoulCityHall, gangnam],
    });
    expect(r.ok).toBe(true);
  });

  it("rejects when coords are missing", () => {
    const r = verifyGpsAttendance({
      coords: undefined,
      geofences: [seoulCityHall],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects when no geofences are configured", () => {
    const r = verifyGpsAttendance({
      coords: { lat: 37.5665, lng: 126.978 },
      geofences: [],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects out-of-range lat / lng values", () => {
    const r = verifyGpsAttendance({
      coords: { lat: 200, lng: 0 },
      geofences: [seoulCityHall],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/invalid/i);
  });
});

describe("WI-604 — verifyManualAttendance", () => {
  const approvers = new Set(["admin_1", "admin_2"]);

  it("accepts when the actor is on the approver list", () => {
    const r = verifyManualAttendance({
      actorId: "admin_1",
      reason: "system outage backfill",
      allowedApproverIds: approvers,
    });
    expect(r.ok).toBe(true);
  });

  it("rejects when the actor is not on the approver list", () => {
    const r = verifyManualAttendance({
      actorId: "user_99",
      reason: "x",
      allowedApproverIds: approvers,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/approver/i);
  });

  it("requires a non-empty reason", () => {
    const r = verifyManualAttendance({
      actorId: "admin_1",
      reason: "",
      allowedApproverIds: approvers,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/reason/i);
  });

  it("rejects when the actor id is missing", () => {
    const r = verifyManualAttendance({
      actorId: undefined,
      reason: "x",
      allowedApproverIds: approvers,
    });
    expect(r.ok).toBe(false);
  });
});

describe("WI-604 — verifyAttendanceContext (method dispatcher)", () => {
  const policy = {
    qr: { resolveExpectedCode: (userId: string) => `code-${userId}` },
    ip: { allowedIps: new Set(["10.0.0.1"]) },
    gps: {
      geofences: [
        { centerLat: 37.5665, centerLng: 126.978, radiusM: 100 },
      ],
    },
    manual: { allowedApproverIds: new Set(["admin_1"]) },
  };

  it("dispatches QR check-in", () => {
    expect(
      verifyAttendanceContext(
        { userId: "u1", method: "QR", qrCode: "code-u1" },
        policy,
      ).ok,
    ).toBe(true);
  });

  it("dispatches IP check-in", () => {
    expect(
      verifyAttendanceContext(
        { userId: "u1", method: "IP", ipAddress: "10.0.0.1" },
        policy,
      ).ok,
    ).toBe(true);
  });

  it("dispatches GPS check-in", () => {
    expect(
      verifyAttendanceContext(
        {
          userId: "u1",
          method: "GPS",
          coords: { lat: 37.5665, lng: 126.978 },
        },
        policy,
      ).ok,
    ).toBe(true);
  });

  it("dispatches MANUAL check-in", () => {
    expect(
      verifyAttendanceContext(
        {
          userId: "u1",
          method: "MANUAL",
          manualActorId: "admin_1",
          manualReason: "outage backfill",
        },
        policy,
      ).ok,
    ).toBe(true);
  });

  it("returns a method-tagged failure for the wrong context", () => {
    const r = verifyAttendanceContext(
      { userId: "u1", method: "QR", qrCode: "WRONG" },
      policy,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.method).toBe("QR");
      expect(r.reason).toMatch(/mismatch/i);
    }
  });

  it("rejects when the method-specific policy is missing", () => {
    const r = verifyAttendanceContext(
      { userId: "u1", method: "GPS", coords: { lat: 0, lng: 0 } },
      { qr: policy.qr }, // gps policy not provided
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/policy/i);
  });
});
