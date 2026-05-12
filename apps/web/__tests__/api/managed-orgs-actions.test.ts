/**
 * WI-620 — Managed-org server-action tests.
 *
 * Exercises the four actions in apps/web/app/(app)/settings/managed-orgs/actions.ts:
 *  - createManagedOrgAction: auth, subscription, cap, zod validation, grant
 *  - updateManagedOrgPacksAction: ownership check + persist
 *  - setManagedOrgStatusAction: ownership check + status transition
 *  - setActiveTenantAction: empty → clear cookie, valid → set cookie, missing
 *    scope → reject
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireOrgAdminMock = vi.fn();

const subscriptionFindUniqueMock = vi.fn();
const managedOrgCountMock = vi.fn();
const managedOrgCreateMock = vi.fn();
const managedOrgFindFirstMock = vi.fn();
const managedOrgUpdateMock = vi.fn();

const grantTenantScopeMock = vi.fn();
const checkTenantScopeMock = vi.fn();

const revalidatePathMock = vi.fn();

const cookieSetMock = vi.fn();
const cookieDeleteMock = vi.fn();

vi.mock("@axle/auth", () => ({
  requireOrgAdmin: () => requireOrgAdminMock(),
  grantTenantScope: (...a: unknown[]) => grantTenantScopeMock(...a),
  checkTenantScope: (...a: unknown[]) => checkTenantScopeMock(...a),
}));

vi.mock("@axle/db", () => ({
  prisma: {
    orgMultiOrgSubscription: {
      findUnique: (...a: unknown[]) => subscriptionFindUniqueMock(...a),
    },
    managedOrg: {
      count: (...a: unknown[]) => managedOrgCountMock(...a),
      create: (...a: unknown[]) => managedOrgCreateMock(...a),
      findFirst: (...a: unknown[]) => managedOrgFindFirstMock(...a),
      update: (...a: unknown[]) => managedOrgUpdateMock(...a),
    },
  },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: (...a: unknown[]) => cookieSetMock(...a),
    delete: (...a: unknown[]) => cookieDeleteMock(...a),
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidatePathMock(...a),
}));

async function loadActions() {
  return import("../../app/(app)/settings/managed-orgs/actions");
}

const resetAllMocks = () => {
  requireOrgAdminMock.mockReset();
  subscriptionFindUniqueMock.mockReset();
  managedOrgCountMock.mockReset();
  managedOrgCreateMock.mockReset();
  managedOrgFindFirstMock.mockReset();
  managedOrgUpdateMock.mockReset();
  grantTenantScopeMock.mockReset().mockResolvedValue(undefined);
  checkTenantScopeMock.mockReset();
  revalidatePathMock.mockReset();
  cookieSetMock.mockReset();
  cookieDeleteMock.mockReset();
};

describe("WI-620 — createManagedOrgAction", () => {
  beforeEach(resetAllMocks);

  it("rejects non-admin callers", async () => {
    requireOrgAdminMock.mockRejectedValueOnce(new Error("FORBIDDEN"));
    const { createManagedOrgAction } = await loadActions();
    const result = await createManagedOrgAction({ name: "X" });
    expect(result).toEqual({ ok: false, error: "권한이 없습니다" });
    expect(managedOrgCreateMock).not.toHaveBeenCalled();
  });

  it("rejects empty name (zod)", async () => {
    requireOrgAdminMock.mockResolvedValueOnce({ id: "u1", orgId: "org-1" });
    const { createManagedOrgAction } = await loadActions();
    const result = await createManagedOrgAction({ name: "" });
    expect(result.ok).toBe(false);
  });

  it("rejects when subscription not enabled", async () => {
    requireOrgAdminMock.mockResolvedValueOnce({ id: "u1", orgId: "org-1" });
    subscriptionFindUniqueMock.mockResolvedValueOnce(null);
    const { createManagedOrgAction } = await loadActions();
    const result = await createManagedOrgAction({ name: "ABC" });
    expect(result).toEqual({
      ok: false,
      error: "Multi-org 구독이 활성화되지 않았습니다",
    });
    expect(managedOrgCreateMock).not.toHaveBeenCalled();
  });

  it("rejects when at the maxManaged cap", async () => {
    requireOrgAdminMock.mockResolvedValueOnce({ id: "u1", orgId: "org-1" });
    subscriptionFindUniqueMock.mockResolvedValueOnce({
      enabled: true,
      maxManaged: 3,
    });
    managedOrgCountMock.mockResolvedValueOnce(3);
    const { createManagedOrgAction } = await loadActions();
    const result = await createManagedOrgAction({ name: "ABC" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/한도/);
    expect(managedOrgCreateMock).not.toHaveBeenCalled();
  });

  it("creates the row and grants tenant scope to the creator", async () => {
    requireOrgAdminMock.mockResolvedValueOnce({ id: "u1", orgId: "org-1" });
    subscriptionFindUniqueMock.mockResolvedValueOnce({
      enabled: true,
      maxManaged: 10,
    });
    managedOrgCountMock.mockResolvedValueOnce(1);
    managedOrgCreateMock.mockResolvedValueOnce({ id: "managed-new" });
    const { createManagedOrgAction } = await loadActions();
    const result = await createManagedOrgAction({
      name: "ABC Manufacturing",
      bizRegNumber: "123-45-67890",
    });
    expect(result).toEqual({ ok: true, data: { id: "managed-new" } });
    expect(managedOrgCreateMock).toHaveBeenCalledTimes(1);
    expect(grantTenantScopeMock).toHaveBeenCalledWith("u1", "managed-new");
    expect(revalidatePathMock).toHaveBeenCalledWith("/settings/managed-orgs");
  });
});

describe("WI-620 — updateManagedOrgPacksAction", () => {
  beforeEach(resetAllMocks);

  it("refuses when the managed org is not owned by the caller", async () => {
    requireOrgAdminMock.mockResolvedValueOnce({ id: "u1", orgId: "org-1" });
    managedOrgFindFirstMock.mockResolvedValueOnce(null);
    const { updateManagedOrgPacksAction } = await loadActions();
    const result = await updateManagedOrgPacksAction("foreign", {
      installedPacks: ["D"],
    });
    expect(result.ok).toBe(false);
    expect(managedOrgUpdateMock).not.toHaveBeenCalled();
  });

  it("persists the new pack list", async () => {
    requireOrgAdminMock.mockResolvedValueOnce({ id: "u1", orgId: "org-1" });
    managedOrgFindFirstMock.mockResolvedValueOnce({ id: "managed-1" });
    const { updateManagedOrgPacksAction } = await loadActions();
    const result = await updateManagedOrgPacksAction("managed-1", {
      installedPacks: ["A", "D"],
    });
    expect(result).toEqual({ ok: true });
    expect(managedOrgUpdateMock).toHaveBeenCalledWith({
      where: { id: "managed-1" },
      data: { installedPacks: ["A", "D"] },
    });
  });

  it("rejects unknown pack id via zod enum", async () => {
    requireOrgAdminMock.mockResolvedValueOnce({ id: "u1", orgId: "org-1" });
    const { updateManagedOrgPacksAction } = await loadActions();
    const result = await updateManagedOrgPacksAction("managed-1", {
      // @ts-expect-error — testing runtime guard
      installedPacks: ["Z"],
    });
    expect(result.ok).toBe(false);
  });
});

describe("WI-620 — setManagedOrgStatusAction", () => {
  beforeEach(resetAllMocks);

  it("rejects unknown status", async () => {
    requireOrgAdminMock.mockResolvedValueOnce({ id: "u1", orgId: "org-1" });
    const { setManagedOrgStatusAction } = await loadActions();
    const result = await setManagedOrgStatusAction(
      "managed-1",
      // @ts-expect-error — testing runtime guard
      "BANANA",
    );
    expect(result.ok).toBe(false);
  });

  it("rejects when not owned by the caller", async () => {
    requireOrgAdminMock.mockResolvedValueOnce({ id: "u1", orgId: "org-1" });
    managedOrgFindFirstMock.mockResolvedValueOnce(null);
    const { setManagedOrgStatusAction } = await loadActions();
    const result = await setManagedOrgStatusAction("foreign", "PAUSED");
    expect(result.ok).toBe(false);
    expect(managedOrgUpdateMock).not.toHaveBeenCalled();
  });

  it("persists the new status", async () => {
    requireOrgAdminMock.mockResolvedValueOnce({ id: "u1", orgId: "org-1" });
    managedOrgFindFirstMock.mockResolvedValueOnce({ id: "managed-1" });
    const { setManagedOrgStatusAction } = await loadActions();
    const result = await setManagedOrgStatusAction("managed-1", "PAUSED");
    expect(result).toEqual({ ok: true });
    expect(managedOrgUpdateMock).toHaveBeenCalledWith({
      where: { id: "managed-1" },
      data: { status: "PAUSED" },
    });
  });
});

describe("WI-620 — setActiveTenantAction", () => {
  beforeEach(resetAllMocks);

  it("clears the cookie when called with empty string", async () => {
    requireOrgAdminMock.mockResolvedValueOnce({ id: "u1", orgId: "org-1" });
    const { setActiveTenantAction } = await loadActions();
    const result = await setActiveTenantAction("");
    expect(result).toEqual({ ok: true });
    expect(cookieDeleteMock).toHaveBeenCalledWith("axle_active_tenant");
    expect(cookieSetMock).not.toHaveBeenCalled();
  });

  it("clears the cookie when called with the owner orgId", async () => {
    requireOrgAdminMock.mockResolvedValueOnce({ id: "u1", orgId: "org-1" });
    const { setActiveTenantAction } = await loadActions();
    const result = await setActiveTenantAction("org-1");
    expect(result).toEqual({ ok: true });
    expect(cookieDeleteMock).toHaveBeenCalled();
  });

  it("rejects when the managed org is not owned by the caller", async () => {
    requireOrgAdminMock.mockResolvedValueOnce({ id: "u1", orgId: "org-1" });
    managedOrgFindFirstMock.mockResolvedValueOnce(null);
    const { setActiveTenantAction } = await loadActions();
    const result = await setActiveTenantAction("foreign-managed");
    expect(result.ok).toBe(false);
    expect(cookieSetMock).not.toHaveBeenCalled();
  });

  it("rejects when the user has no tenant scope", async () => {
    requireOrgAdminMock.mockResolvedValueOnce({ id: "u1", orgId: "org-1" });
    managedOrgFindFirstMock.mockResolvedValueOnce({ id: "managed-1" });
    checkTenantScopeMock.mockResolvedValueOnce(false);
    const { setActiveTenantAction } = await loadActions();
    const result = await setActiveTenantAction("managed-1");
    expect(result.ok).toBe(false);
    expect(cookieSetMock).not.toHaveBeenCalled();
  });

  it("sets the cookie when user holds the tenant scope", async () => {
    requireOrgAdminMock.mockResolvedValueOnce({ id: "u1", orgId: "org-1" });
    managedOrgFindFirstMock.mockResolvedValueOnce({ id: "managed-1" });
    checkTenantScopeMock.mockResolvedValueOnce(true);
    const { setActiveTenantAction } = await loadActions();
    const result = await setActiveTenantAction("managed-1");
    expect(result).toEqual({ ok: true });
    expect(cookieSetMock).toHaveBeenCalledTimes(1);
    const [name, value, opts] = cookieSetMock.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(name).toBe("axle_active_tenant");
    expect(value).toBe("managed-1");
    expect(opts.httpOnly).toBe(true);
    expect(opts.path).toBe("/");
  });
});
