/**
 * ERP scope guard.
 *
 * Resolves the active tenant for the current user (Multi-org cookie aware) and
 * checks the requested ReBAC scope (erp:read / erp:write / etc.) against the
 * resolved tenant id. Throws {@link ErpAuthError} on failure so route handlers
 * can map the error to a consistent HTTP response via {@link toResponse}.
 *
 * Error envelope — all responses produced by {@link toResponse} follow the
 * canonical AXLE shape:
 *   { error: { code: <UPPER_SNAKE>, message: <human-readable> } }
 * which matches `apps/web/lib/api-helpers.ts`. Status codes:
 *   401 UNAUTHORIZED, 403 FORBIDDEN, 404 NOT_FOUND, 409 CONFLICT,
 *   400 VALIDATION_ERROR, 500 INTERNAL_ERROR.
 */

import { getCurrentUser, checkModulePermission } from "@axle/auth";
import { prisma } from "@axle/db";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { NextResponse } from "next/server";
import { getActiveTenant } from "@/src/lib/tenant-context";

export type ErpScope = "erp:read" | "erp:write";

export class ErpAuthError extends Error {
  constructor(public readonly status: 401 | 403, message: string) {
    super(message);
    this.name = "ErpAuthError";
  }
}

/**
 * Domain conflict (HTTP 409). Used for idempotency violations or invalid
 * state transitions (e.g. cancelling a DRAFT order, double-cancelling an
 * already CANCELLED order, or unique-constraint violations from the DB).
 */
export class ErpConflictError extends Error {
  public readonly status = 409 as const;
  constructor(
    message: string,
    /** Optional list of fields that triggered the conflict (e.g. ["sku"]). */
    public readonly fields?: string[],
  ) {
    super(message);
    this.name = "ErpConflictError";
  }
}

/** Resource not found in the active tenant (HTTP 404). */
export class ErpNotFoundError extends Error {
  public readonly status = 404 as const;
  constructor(message: string) {
    super(message);
    this.name = "ErpNotFoundError";
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
 * Build a canonical error response: `{ error: { code, message, ...extra } }`.
 */
export function erpErrorResponse(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
): Response {
  return NextResponse.json(
    { error: { code, message, ...(extra ?? {}) } },
    { status },
  );
}

/** Shortcut for inline 400 responses in route handlers (e.g. missing path
 * parameters that schema validation cannot catch). */
export function erpBadRequest(message: string): Response {
  return erpErrorResponse(400, "VALIDATION_ERROR", message);
}

/**
 * Convert an error caught in an ERP route into a `Response`.
 *
 * Envelope: `{ error: { code, message, ...details } }` — see file header.
 *
 *  - {@link ErpAuthError} 401 → UNAUTHORIZED, 403 → FORBIDDEN
 *  - {@link ErpConflictError} → 409 CONFLICT (with optional `fields` array)
 *  - {@link ErpNotFoundError} → 404 NOT_FOUND
 *  - {@link ZodError} → 400 VALIDATION_ERROR (with `issues` array)
 *  - {@link Prisma.PrismaClientKnownRequestError} P2002 → 409 CONFLICT (with
 *    `fields` from `err.meta.target`). Other P codes fall through to 500.
 *  - Anything else → 500 INTERNAL_ERROR (original error is logged).
 */
export function toResponse(err: unknown): Response {
  if (err instanceof ErpAuthError) {
    return erpErrorResponse(
      err.status,
      err.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
      err.message,
    );
  }
  if (err instanceof ErpConflictError) {
    return erpErrorResponse(409, "CONFLICT", err.message, {
      ...(err.fields ? { fields: err.fields } : {}),
    });
  }
  if (err instanceof ErpNotFoundError) {
    return erpErrorResponse(404, "NOT_FOUND", err.message);
  }
  if (err instanceof ZodError) {
    const issues = err.issues ?? [];
    const message =
      issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ") || "Validation failed";
    return erpErrorResponse(400, "VALIDATION_ERROR", message, { issues });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    const target = err.meta?.target;
    const fields = Array.isArray(target)
      ? (target as string[])
      : typeof target === "string"
        ? [target]
        : undefined;
    const fieldList = fields && fields.length > 0 ? fields.join(", ") : "unique field";
    return erpErrorResponse(409, "CONFLICT", `Duplicate value for ${fieldList}`, {
      ...(fields ? { fields } : {}),
    });
  }
  console.error("[erp] internal error:", err);
  return erpErrorResponse(500, "INTERNAL_ERROR", "Internal server error");
}
