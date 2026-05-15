/**
 * ERP scope guard.
 *
 * Resolves the active tenant for the current user (Multi-org cookie aware) and
 * checks the requested ReBAC scope (erp:read / erp:write / etc.) against the
 * resolved tenant id. Throws {@link ErpAuthError} on failure so route handlers
 * can map the error to a consistent HTTP response via {@link toResponse}.
 */

import { getCurrentUser, checkModulePermission } from "@axle/auth";
import { prisma } from "@axle/db";
import { getActiveTenant } from "@/src/lib/tenant-context";

export type ErpScope = "erp:read" | "erp:write";

export class ErpAuthError extends Error {
  constructor(public readonly status: 401 | 403, message: string) {
    super(message);
    this.name = "ErpAuthError";
  }
}

export interface ErpAuthContext {
  /** Authenticated user id. */
  userId: string;
  /** Active tenant id (owner org id, or ManagedOrg.id when Multi-org cookie selects one). */
  orgId: string;
  /** True when the active tenant is a ManagedOrg (not the owner org itself). */
  isManagedTenant: boolean;
  /** Display name of the active tenant. */
  tenantName: string;
  /** The scope the caller satisfied. */
  scope: ErpScope;
}

/**
 * Require the caller to have `scope` on the active tenant.
 *
 * @throws {ErpAuthError} 401 when no user / no owner org, 403 when scope missing.
 */
export async function requireErpScope(scope: ErpScope): Promise<ErpAuthContext> {
  const user = await getCurrentUser();
  if (!user || !user.orgId) {
    throw new ErpAuthError(401, "Unauthorized");
  }

  const ownerOrg = await prisma.organization.findUnique({
    where: { id: user.orgId },
    select: { name: true },
  });
  if (!ownerOrg) {
    throw new ErpAuthError(401, "Owner org not found");
  }

  const tenant = await getActiveTenant(user.orgId, ownerOrg.name);
  const ok = await checkModulePermission(user.id, tenant.id, scope);
  if (!ok) {
    throw new ErpAuthError(403, `Missing scope: ${scope}`);
  }

  return {
    userId: user.id,
    orgId: tenant.id,
    isManagedTenant: tenant.isManaged,
    tenantName: tenant.name,
    scope,
  };
}

/**
 * Convert an error caught in an ERP route into a `Response`.
 *
 * - {@link ErpAuthError} → its declared status with the message body.
 * - `ZodError` (duck-typed) → 400 with the issue array as JSON.
 * - Anything else → 500 with a generic message; the original error is logged.
 */
export function toResponse(err: unknown): Response {
  if (err instanceof ErpAuthError) {
    return new Response(err.message, { status: err.status });
  }
  if (isZodError(err)) {
    return Response.json(
      { error: "ValidationError", issues: err.issues },
      { status: 400 },
    );
  }
  console.error("[erp] internal error:", err);
  return new Response("Internal error", { status: 500 });
}

interface ZodIssueLike {
  path: (string | number)[];
  message: string;
  code?: string;
}

interface ZodErrorLike {
  name: string;
  issues: ZodIssueLike[];
}

function isZodError(err: unknown): err is ZodErrorLike {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: unknown }).name === "ZodError" &&
    Array.isArray((err as { issues?: unknown }).issues)
  );
}
