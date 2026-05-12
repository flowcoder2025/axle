/**
 * WI-620 — tenant-context resolution tests.
 *
 * Covers the three branches of getActiveTenant() + listAvailableTenants():
 *  - No subscription / disabled → owner org only, cookie ignored
 *  - Enabled + empty cookie → owner org
 *  - Enabled + cookie pointing at an active ManagedOrg → that managed org
 *  - Enabled + cookie pointing at an inactive / unknown id → owner org
 *  - listAvailableTenants filters by checkTenantScope
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Cookie store mock — controlled via setCookie() per-test.
let cookieValue: string | undefined;
const setCookie = (v: string | undefined) => {
  cookieValue = v;
};
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "axle_active_tenant" && cookieValue
        ? { value: cookieValue }
        : undefined,
  }),
}));

// Prisma mocks
const subscriptionFindUniqueMock = vi.fn();
const managedOrgFindFirstMock = vi.fn();
const managedOrgFindManyMock = vi.fn();
vi.mock("@axle/db", () => ({
  prisma: {
    orgMultiOrgSubscription: {
      findUnique: (...a: unknown[]) => subscriptionFindUniqueMock(...a),
    },
    managedOrg: {
      findFirst: (...a: unknown[]) => managedOrgFindFirstMock(...a),
      findMany: (...a: unknown[]) => managedOrgFindManyMock(...a),
    },
  },
}));

const checkTenantScopeMock = vi.fn();
vi.mock("@axle/auth", () => ({
  checkTenantScope: (...a: unknown[]) => checkTenantScopeMock(...a),
}));

async function loadModule() {
  return import("../../src/lib/tenant-context");
}

describe("WI-620 — getActiveTenant", () => {
  beforeEach(() => {
    cookieValue = undefined;
    subscriptionFindUniqueMock.mockReset();
    managedOrgFindFirstMock.mockReset();
  });

  it("returns owner org when no subscription row exists", async () => {
    subscriptionFindUniqueMock.mockResolvedValueOnce(null);
    const { getActiveTenant } = await loadModule();
    const result = await getActiveTenant("org-1", "ACME");
    expect(result).toEqual({ id: "org-1", isManaged: false, name: "ACME" });
    expect(managedOrgFindFirstMock).not.toHaveBeenCalled();
  });

  it("returns owner org when subscription exists but enabled=false", async () => {
    subscriptionFindUniqueMock.mockResolvedValueOnce({ enabled: false });
    const { getActiveTenant } = await loadModule();
    const result = await getActiveTenant("org-1", "ACME");
    expect(result.isManaged).toBe(false);
  });

  it("returns owner org when subscription enabled but cookie missing", async () => {
    subscriptionFindUniqueMock.mockResolvedValueOnce({ enabled: true });
    const { getActiveTenant } = await loadModule();
    const result = await getActiveTenant("org-1", "ACME");
    expect(result.id).toBe("org-1");
    expect(result.isManaged).toBe(false);
  });

  it("returns the managed org when cookie matches an active row", async () => {
    cookieValue = "managed-7";
    subscriptionFindUniqueMock.mockResolvedValueOnce({ enabled: true });
    managedOrgFindFirstMock.mockResolvedValueOnce({
      id: "managed-7",
      name: "ABC",
    });
    const { getActiveTenant } = await loadModule();
    const result = await getActiveTenant("org-1", "ACME");
    expect(result).toEqual({ id: "managed-7", isManaged: true, name: "ABC" });
  });

  it("falls back to owner org when cookie points at unknown/inactive id", async () => {
    cookieValue = "stale-id";
    subscriptionFindUniqueMock.mockResolvedValueOnce({ enabled: true });
    managedOrgFindFirstMock.mockResolvedValueOnce(null);
    const { getActiveTenant } = await loadModule();
    const result = await getActiveTenant("org-1", "ACME");
    expect(result).toEqual({ id: "org-1", isManaged: false, name: "ACME" });
  });
});

describe("WI-620 — listAvailableTenants", () => {
  beforeEach(() => {
    subscriptionFindUniqueMock.mockReset();
    managedOrgFindManyMock.mockReset();
    checkTenantScopeMock.mockReset();
  });

  it("returns just self when subscription disabled", async () => {
    subscriptionFindUniqueMock.mockResolvedValueOnce({ enabled: false });
    const { listAvailableTenants } = await loadModule();
    const result = await listAvailableTenants("user-1", "org-1", "ACME");
    expect(result).toEqual([{ id: "org-1", name: "ACME", isManaged: false }]);
    expect(managedOrgFindManyMock).not.toHaveBeenCalled();
  });

  it("returns self + every managed org the user has a tenant scope on", async () => {
    subscriptionFindUniqueMock.mockResolvedValueOnce({ enabled: true });
    managedOrgFindManyMock.mockResolvedValueOnce([
      { id: "managed-1", name: "Alpha" },
      { id: "managed-2", name: "Beta" },
      { id: "managed-3", name: "Gamma" },
    ]);
    // Only grant scope on Alpha and Gamma — Beta must be filtered out.
    checkTenantScopeMock.mockImplementation(
      async (_userId: string, mid: string) =>
        mid === "managed-1" || mid === "managed-3",
    );
    const { listAvailableTenants } = await loadModule();
    const result = await listAvailableTenants("user-1", "org-1", "ACME");
    expect(result.map((t) => t.id)).toEqual([
      "org-1",
      "managed-1",
      "managed-3",
    ]);
    expect(result[0].isManaged).toBe(false);
    expect(result[1].isManaged).toBe(true);
  });

  it("self is always the first entry", async () => {
    subscriptionFindUniqueMock.mockResolvedValueOnce({ enabled: true });
    managedOrgFindManyMock.mockResolvedValueOnce([
      { id: "managed-a", name: "Aardvark" },
    ]);
    checkTenantScopeMock.mockResolvedValue(true);
    const { listAvailableTenants } = await loadModule();
    const result = await listAvailableTenants("user-1", "org-1", "ZZ Owner");
    expect(result[0]).toEqual({
      id: "org-1",
      name: "ZZ Owner",
      isManaged: false,
    });
  });
});

describe("WI-620 — isMultiOrgEnabled", () => {
  beforeEach(() => subscriptionFindUniqueMock.mockReset());

  it("returns true only when enabled=true", async () => {
    subscriptionFindUniqueMock.mockResolvedValueOnce({ enabled: true });
    const { isMultiOrgEnabled } = await loadModule();
    expect(await isMultiOrgEnabled("org-1")).toBe(true);
  });

  it("returns false when no row", async () => {
    subscriptionFindUniqueMock.mockResolvedValueOnce(null);
    const { isMultiOrgEnabled } = await loadModule();
    expect(await isMultiOrgEnabled("org-1")).toBe(false);
  });

  it("returns false when row exists but disabled", async () => {
    subscriptionFindUniqueMock.mockResolvedValueOnce({ enabled: false });
    const { isMultiOrgEnabled } = await loadModule();
    expect(await isMultiOrgEnabled("org-1")).toBe(false);
  });
});
