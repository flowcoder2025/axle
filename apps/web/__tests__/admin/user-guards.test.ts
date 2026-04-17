import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@axle/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@axle/db";
import {
  ForbiddenError,
  guardSelfDemotion,
  guardLastAdminDemotion,
  guardSelfDeactivation,
} from "@/lib/admin/user-guards";

const mockFindUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;
const mockCount = prisma.user.count as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFindUnique.mockReset();
  mockCount.mockReset();
});

describe("guardSelfDemotion", () => {
  it("throws when currentUserId === targetUserId", () => {
    expect(() => guardSelfDemotion("u1", "u1")).toThrow(ForbiddenError);
  });

  it("does not throw when users differ", () => {
    expect(() => guardSelfDemotion("u1", "u2")).not.toThrow();
  });
});

describe("guardLastAdminDemotion", () => {
  it("no-ops when newRole is PLATFORM_ADMIN (promotion)", async () => {
    await guardLastAdminDemotion("u1", "PLATFORM_ADMIN");
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("no-ops when target is not currently a platform admin", async () => {
    mockFindUnique.mockResolvedValue({ platformRole: "USER" });
    await guardLastAdminDemotion("u1", "USER");
    expect(mockCount).not.toHaveBeenCalled();
  });

  it("throws when demoting the only remaining admin", async () => {
    mockFindUnique.mockResolvedValue({ platformRole: "PLATFORM_ADMIN" });
    mockCount.mockResolvedValue(1);
    await expect(guardLastAdminDemotion("u1", "USER")).rejects.toThrow(ForbiddenError);
  });

  it("allows demotion when more than one admin exists", async () => {
    mockFindUnique.mockResolvedValue({ platformRole: "PLATFORM_ADMIN" });
    mockCount.mockResolvedValue(2);
    await expect(guardLastAdminDemotion("u1", "USER")).resolves.toBeUndefined();
  });
});

describe("guardSelfDeactivation", () => {
  it("throws when deactivating self", () => {
    expect(() => guardSelfDeactivation("u1", "u1", false)).toThrow(ForbiddenError);
  });

  it("allows deactivating others", () => {
    expect(() => guardSelfDeactivation("u1", "u2", false)).not.toThrow();
  });

  it("allows activating self (newIsActive=true)", () => {
    expect(() => guardSelfDeactivation("u1", "u1", true)).not.toThrow();
  });
});
