/**
 * WI-620 — Multi-org tenant context.
 *
 * The "active tenant" is the org whose data the user is currently viewing.
 * For single-org subscriptions this is always the user's own org. For
 * Multi-org subscribers it can be the owner org itself OR any of the active
 * ManagedOrg rows the user has access to.
 *
 * Persistence: a single httpOnly cookie `axle_active_tenant`. The cookie
 * stores either the empty string (self-org / default) or a ManagedOrg id.
 * No JWT change is needed — the cookie is read on every RSC render.
 */

import { cookies } from "next/headers";
import { prisma } from "@axle/db";
import { checkTenantScope } from "@axle/auth";

/** Cookie name. Exported for tests. */
export const ACTIVE_TENANT_COOKIE = "axle_active_tenant";

export interface ActiveTenant {
  /** ManagedOrg.id when isManaged, otherwise the owner orgId. */
  id: string;
  /** True when scoped to a ManagedOrg, false when scoped to the user's own org. */
  isManaged: boolean;
  /** Display name shown in the topbar. */
  name: string;
}

export interface TenantOption {
  id: string;
  name: string;
  isManaged: boolean;
}

/**
 * Read the active tenant for the given owner org.
 *
 * Resolution:
 *   1. If the org has no `OrgMultiOrgSubscription.enabled=true` row, the
 *      tenant is always the owner org (single-org tier).
 *   2. Otherwise, read the `axle_active_tenant` cookie. Empty string or
 *      missing → owner org. A ManagedOrg id → that managed org if it's
 *      still ACTIVE under this owner.
 *   3. If the cookie points at an unknown / inactive managed org, fall
 *      back silently to the owner org (the cookie may be stale).
 */
export async function getActiveTenant(
  ownerOrgId: string,
  ownerOrgName: string,
): Promise<ActiveTenant> {
  const subscription = await prisma.orgMultiOrgSubscription.findUnique({
    where: { orgId: ownerOrgId },
  });

  if (!subscription?.enabled) {
    return { id: ownerOrgId, isManaged: false, name: ownerOrgName };
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get(ACTIVE_TENANT_COOKIE)?.value ?? "";
  if (!raw) {
    return { id: ownerOrgId, isManaged: false, name: ownerOrgName };
  }

  const managed = await prisma.managedOrg.findFirst({
    where: { id: raw, ownerOrgId, status: "ACTIVE" },
    select: { id: true, name: true },
  });
  if (!managed) {
    return { id: ownerOrgId, isManaged: false, name: ownerOrgName };
  }
  return { id: managed.id, isManaged: true, name: managed.name };
}

/**
 * List every tenant the given user can switch into for `ownerOrgId`.
 *
 * The result always includes the owner org itself at index 0 (UI shows it
 * as the "본인 조직" entry), followed by every ACTIVE ManagedOrg the user
 * has a `tenant:<id>` (or `tenant:*`) scope on.
 */
export async function listAvailableTenants(
  userId: string,
  ownerOrgId: string,
  ownerOrgName: string,
): Promise<TenantOption[]> {
  const subscription = await prisma.orgMultiOrgSubscription.findUnique({
    where: { orgId: ownerOrgId },
  });
  const self: TenantOption = {
    id: ownerOrgId,
    name: ownerOrgName,
    isManaged: false,
  };
  if (!subscription?.enabled) return [self];

  const managedOrgs = await prisma.managedOrg.findMany({
    where: { ownerOrgId, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const allowed: TenantOption[] = [];
  for (const org of managedOrgs) {
    if (await checkTenantScope(userId, org.id)) {
      allowed.push({ id: org.id, name: org.name, isManaged: true });
    }
  }
  return [self, ...allowed];
}

/** True iff `orgId` has Multi-org tenancy enabled. */
export async function isMultiOrgEnabled(orgId: string): Promise<boolean> {
  const subscription = await prisma.orgMultiOrgSubscription.findUnique({
    where: { orgId },
    select: { enabled: true },
  });
  return Boolean(subscription?.enabled);
}
