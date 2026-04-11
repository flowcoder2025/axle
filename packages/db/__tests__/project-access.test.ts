import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/client.js", () => ({
  prisma: {
    projectMember: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "../src/client.js";

describe("checkProjectAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns true when user has LEAD and LEAD is required", async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
      id: "pm-1",
      role: "LEAD",
    } as any);
    const { checkProjectAccess } = await import("../src/project-access.js");
    expect(await checkProjectAccess("u1", "p1", "LEAD")).toBe(true);
  });

  it("returns true when LEAD has > MEMBER (hierarchy)", async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
      id: "pm-1",
      role: "LEAD",
    } as any);
    const { checkProjectAccess } = await import("../src/project-access.js");
    expect(await checkProjectAccess("u1", "p1", "MEMBER")).toBe(true);
  });

  it("returns false when VIEWER < MEMBER", async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
      id: "pm-1",
      role: "VIEWER",
    } as any);
    const { checkProjectAccess } = await import("../src/project-access.js");
    expect(await checkProjectAccess("u1", "p1", "MEMBER")).toBe(false);
  });

  it("returns false when not a member", async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(null);
    const { checkProjectAccess } = await import("../src/project-access.js");
    expect(await checkProjectAccess("u1", "p1", "VIEWER")).toBe(false);
  });
});
