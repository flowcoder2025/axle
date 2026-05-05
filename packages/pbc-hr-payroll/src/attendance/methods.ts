/**
 * Per-AttendanceMethod context verification.
 *
 * Each method has a small, pure verifier (no I/O) so the service can
 * compose them through `verifyAttendanceContext` and so each rule is
 * independently testable. A failure carries a Korean-friendly `reason`
 * string and the offending `method` so the caller can render a useful
 * UX message instead of a generic "verification failed".
 */

import type { AttendanceMethod } from "../types.js";

export type VerificationResult =
  | { ok: true }
  | { ok: false; method?: AttendanceMethod; reason: string };

/* ------------------------------------------------------------------ */
/* QR                                                                  */
/* ------------------------------------------------------------------ */

export function verifyQrAttendance(input: {
  submittedCode: string | undefined;
  expectedCode: string | null;
}): VerificationResult {
  if (!input.submittedCode) {
    return {
      ok: false,
      method: "QR",
      reason: "QR code is missing on the check-in payload",
    };
  }
  if (!input.expectedCode) {
    return {
      ok: false,
      method: "QR",
      reason: "QR code is not registered for this user",
    };
  }
  if (input.submittedCode !== input.expectedCode) {
    return {
      ok: false,
      method: "QR",
      reason: "QR code mismatch",
    };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* IP                                                                  */
/* ------------------------------------------------------------------ */

export function verifyIpAttendance(input: {
  ip: string | undefined;
  allowedIps: ReadonlySet<string>;
}): VerificationResult {
  if (!input.ip) {
    return {
      ok: false,
      method: "IP",
      reason: "Source IP is missing on the check-in payload",
    };
  }
  if (input.allowedIps.size === 0) {
    return {
      ok: false,
      method: "IP",
      reason: "IP allow-list is empty (defensive default)",
    };
  }
  if (!input.allowedIps.has(input.ip)) {
    return {
      ok: false,
      method: "IP",
      reason: `Source IP ${input.ip} is not allowed`,
    };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* GPS                                                                 */
/* ------------------------------------------------------------------ */

export interface Geofence {
  centerLat: number;
  centerLng: number;
  /** Radius in meters. */
  radiusM: number;
}

const EARTH_RADIUS_M = 6_371_000;

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(sa)));
}

export function verifyGpsAttendance(input: {
  coords: { lat: number; lng: number } | undefined;
  geofences: ReadonlyArray<Geofence>;
}): VerificationResult {
  if (!input.coords) {
    return {
      ok: false,
      method: "GPS",
      reason: "GPS coordinates are missing on the check-in payload",
    };
  }
  const { lat, lng } = input.coords;
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return {
      ok: false,
      method: "GPS",
      reason: `Invalid coordinates: lat=${lat}, lng=${lng}`,
    };
  }
  if (input.geofences.length === 0) {
    return {
      ok: false,
      method: "GPS",
      reason: "No geofences are configured for the GPS method",
    };
  }
  for (const fence of input.geofences) {
    const distance = haversineMeters(input.coords, {
      lat: fence.centerLat,
      lng: fence.centerLng,
    });
    if (distance <= fence.radiusM) return { ok: true };
  }
  return {
    ok: false,
    method: "GPS",
    reason: "Position is outside every configured geofence",
  };
}

/* ------------------------------------------------------------------ */
/* MANUAL                                                              */
/* ------------------------------------------------------------------ */

export function verifyManualAttendance(input: {
  actorId: string | undefined;
  reason: string | undefined;
  allowedApproverIds: ReadonlySet<string>;
}): VerificationResult {
  if (!input.actorId) {
    return {
      ok: false,
      method: "MANUAL",
      reason: "Manual entry requires an actor id",
    };
  }
  if (!input.allowedApproverIds.has(input.actorId)) {
    return {
      ok: false,
      method: "MANUAL",
      reason: `Actor ${input.actorId} is not on the manual approver list`,
    };
  }
  if (!input.reason || input.reason.trim().length === 0) {
    return {
      ok: false,
      method: "MANUAL",
      reason: "Manual entry requires a non-empty reason",
    };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Dispatcher                                                          */
/* ------------------------------------------------------------------ */

export interface AttendanceVerificationPolicy {
  qr?: { resolveExpectedCode(userId: string): string | null };
  ip?: { allowedIps: ReadonlySet<string> };
  gps?: { geofences: ReadonlyArray<Geofence> };
  manual?: { allowedApproverIds: ReadonlySet<string> };
}

export interface AttendanceCheckInInput {
  userId: string;
  method: AttendanceMethod;
  qrCode?: string;
  ipAddress?: string;
  coords?: { lat: number; lng: number };
  manualActorId?: string;
  manualReason?: string;
}

export function verifyAttendanceContext(
  input: AttendanceCheckInInput,
  policy: AttendanceVerificationPolicy,
): VerificationResult {
  switch (input.method) {
    case "QR":
      if (!policy.qr) {
        return {
          ok: false,
          method: "QR",
          reason: "No QR policy is configured on the service",
        };
      }
      return verifyQrAttendance({
        submittedCode: input.qrCode,
        expectedCode: policy.qr.resolveExpectedCode(input.userId),
      });
    case "IP":
      if (!policy.ip) {
        return {
          ok: false,
          method: "IP",
          reason: "No IP policy is configured on the service",
        };
      }
      return verifyIpAttendance({
        ip: input.ipAddress,
        allowedIps: policy.ip.allowedIps,
      });
    case "GPS":
      if (!policy.gps) {
        return {
          ok: false,
          method: "GPS",
          reason: "No GPS policy is configured on the service",
        };
      }
      return verifyGpsAttendance({
        coords: input.coords,
        geofences: policy.gps.geofences,
      });
    case "MANUAL":
      if (!policy.manual) {
        return {
          ok: false,
          method: "MANUAL",
          reason: "No MANUAL policy is configured on the service",
        };
      }
      return verifyManualAttendance({
        actorId: input.manualActorId,
        reason: input.manualReason,
        allowedApproverIds: policy.manual.allowedApproverIds,
      });
  }
}
