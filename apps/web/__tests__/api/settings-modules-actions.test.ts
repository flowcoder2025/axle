/**
 * WI-617 — Server-action authorization + zod validation tests.
 *
 * Renders for the page aren't covered (no jsdom in apps/web). Instead these
 * tests exercise the four server actions (install/uninstall × pack/module):
 *  - non-admin users are rejected with an actionable error
 *  - unknown pack/module ids are rejected before any prisma call
 *  - admins land an upsert / deleteMany call for the right rows
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireOrgAdminMock = vi.fn();
const upsertMock = vi.fn().mockResolvedValue(undefined);
const deleteManyMock = vi.fn().mockResolvedValue({ count: 0 });
const revalidatePathMock = vi.fn();

vi.mock("@axle/auth", () => ({
  requireOrgAdmin: () => requireOrgAdminMock(),
}));

vi.mock("@axle/db", () => ({
  prisma: {
    orgModuleInstall: {
      upsert: (...args: unknown[]) => upsertMock(...args),
      deleteMany: (...args: unknown[]) => deleteManyMock(...args),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

async function loadActions() {
  return import("../../app/(app)/settings/modules/actions");
}

describe("WI-617 — installPackAction", () => {
  beforeEach(() => {
    requireOrgAdminMock.mockReset();
    upsertMock.mockReset().mockResolvedValue(undefined);
    deleteManyMock.mockReset().mockResolvedValue({ count: 0 });
    revalidatePathMock.mockReset();
  });

  it("rejects non-admin callers with a user-visible error", async () => {
    requireOrgAdminMock.mockRejectedValueOnce(new Error("FORBIDDEN"));
    const { installPackAction } = await loadActions();
    const result = await installPackAction("A");
    expect(result).toEqual({ ok: false, error: "권한이 없습니다" });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rejects unknown pack ids before touching the database", async () => {
    requireOrgAdminMock.mockResolvedValueOnce({
      id: "u1",
      orgId: "org-1",
    });
    const { installPackAction } = await loadActions();
    const result = await installPackAction("ZZ");
    expect(result).toEqual({ ok: false, error: "알 수 없는 Pack 입니다" });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("upserts every module of the pack for the org admin", async () => {
    requireOrgAdminMock.mockResolvedValueOnce({
      id: "u1",
      orgId: "org-1",
    });
    const { installPackAction } = await loadActions();
    const result = await installPackAction("D");
    expect(result).toEqual({ ok: true });
    // Pack D has 5 modules
    expect(upsertMock).toHaveBeenCalledTimes(5);
    // Spot-check one of the upsert calls
    const calledWith = upsertMock.mock.calls.map(
      (c) => (c[0] as { create: { moduleId: string } }).create.moduleId,
    );
    expect(calledWith).toEqual(
      expect.arrayContaining([
        "employees",
        "payroll",
        "attendance",
        "leave",
        "nomu",
      ]),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/settings/modules");
  });
});

describe("WI-617 — uninstallPackAction", () => {
  beforeEach(() => {
    requireOrgAdminMock.mockReset();
    upsertMock.mockReset().mockResolvedValue(undefined);
    deleteManyMock.mockReset().mockResolvedValue({ count: 0 });
    revalidatePathMock.mockReset();
  });

  it("rejects non-admin callers", async () => {
    requireOrgAdminMock.mockRejectedValueOnce(new Error("FORBIDDEN"));
    const { uninstallPackAction } = await loadActions();
    const result = await uninstallPackAction("A");
    expect(result.ok).toBe(false);
    expect(deleteManyMock).not.toHaveBeenCalled();
  });

  it("deletes every module of the pack in a single deleteMany", async () => {
    requireOrgAdminMock.mockResolvedValueOnce({
      id: "u1",
      orgId: "org-1",
    });
    const { uninstallPackAction } = await loadActions();
    const result = await uninstallPackAction("E");
    expect(result).toEqual({ ok: true });
    expect(deleteManyMock).toHaveBeenCalledTimes(1);
    const call = deleteManyMock.mock.calls[0][0] as {
      where: { orgId: string; moduleId: { in: string[] } };
    };
    expect(call.where.orgId).toBe("org-1");
    expect(call.where.moduleId.in.sort()).toEqual(
      ["builder", "create", "presets", "workflows"].sort(),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/settings/modules");
  });
});

describe("WI-617 — installModuleAction / uninstallModuleAction", () => {
  beforeEach(() => {
    requireOrgAdminMock.mockReset();
    upsertMock.mockReset().mockResolvedValue(undefined);
    deleteManyMock.mockReset().mockResolvedValue({ count: 0 });
    revalidatePathMock.mockReset();
  });

  it("installModuleAction upserts a single row", async () => {
    requireOrgAdminMock.mockResolvedValueOnce({ id: "u1", orgId: "org-1" });
    const { installModuleAction } = await loadActions();
    await installModuleAction("calendar");
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const call = upsertMock.mock.calls[0][0] as {
      where: { orgId_moduleId: { orgId: string; moduleId: string } };
    };
    expect(call.where.orgId_moduleId).toEqual({
      orgId: "org-1",
      moduleId: "calendar",
    });
  });

  it("installModuleAction rejects unknown module ids", async () => {
    requireOrgAdminMock.mockResolvedValueOnce({ id: "u1", orgId: "org-1" });
    const { installModuleAction } = await loadActions();
    const result = await installModuleAction("ghost");
    expect(result).toEqual({ ok: false, error: "알 수 없는 모듈입니다" });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("uninstallModuleAction deletes a single row for the org", async () => {
    requireOrgAdminMock.mockResolvedValueOnce({ id: "u1", orgId: "org-1" });
    const { uninstallModuleAction } = await loadActions();
    await uninstallModuleAction("payroll");
    expect(deleteManyMock).toHaveBeenCalledTimes(1);
    const call = deleteManyMock.mock.calls[0][0] as {
      where: { orgId: string; moduleId: string };
    };
    expect(call.where).toEqual({ orgId: "org-1", moduleId: "payroll" });
  });
});
