/**
 * Counterparty resolver (Phase 21 WI-723c).
 *
 * Service-layer guarantee that every new `Order` has `counterpartyId` set
 * (the FK is VALIDATEd in migration `20260517000003_..._fk_validate`).
 * Callers always pass `counterpartyName` (the immutable historical snapshot)
 * and either `counterpartyId` (when the UI already picked a master) or
 * leave it null — in which case this module finds or creates one.
 *
 * Lookup order:
 *
 *   1. If `counterpartyId` is provided, verify it belongs to the tenant and
 *      is not soft-deleted. We do NOT silently substitute a different master
 *      when the id is wrong — that would hide UI bugs. Throws on mismatch.
 *   2. Otherwise, if `bizRegNo` (canonical, 10 digits) is provided, find the
 *      existing ErpCounterparty by `(orgId, bizRegNo)`. The partial unique
 *      index guarantees at most one match.
 *   3. Otherwise, look up by `(orgId, normalizedName, deletedAt=NULL)` and
 *      pick a candidate only if there is exactly one. Multiple matches are
 *      ambiguous — the resolver creates a new master rather than guessing.
 *   4. If nothing matches, create a fresh ErpCounterparty with `type=BOTH`
 *      (callers can refine later via the CRUD UI).
 *
 * The resolver runs inside the caller's Prisma transaction (e.g. the
 * intake/confirm route's $transaction) so the matched-or-created id stays
 * consistent with the Order insert that follows. The returned id is safe to
 * use as `Order.counterpartyId` because the FK is now VALID.
 *
 * **Important**: `counterpartyName` on Order is *not* refreshed by this
 * function. Order.counterpartyName is a snapshot for historical reporting
 * and intentionally preserved verbatim (design §4.5). The resolver does not
 * mutate the matched ErpCounterparty either — name edits go through
 * `/api/erp/counterparties/[id]` (WI-722).
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import {
  normalizeCounterpartyName,
  canonicalizeBizRegNo,
} from "@/lib/erp/counterparty-utils";

const DEFAULT_TYPE: "CUSTOMER" | "SUPPLIER" | "BOTH" = "BOTH";

export type CounterpartyTxClient = Pick<
  Prisma.TransactionClient,
  "erpCounterparty"
>;

export class CounterpartyResolutionError extends Error {
  constructor(
    /** Stable code so route handlers can pick the right HTTP status. */
    public readonly code:
      | "COUNTERPARTY_NOT_IN_TENANT"
      | "COUNTERPARTY_NAME_REQUIRED",
    message: string,
  ) {
    super(message);
    this.name = "CounterpartyResolutionError";
  }
}

export interface ResolveInput {
  orgId: string;
  /** Optional id selected by the UI. Verified, never silently substituted. */
  counterpartyId?: string | null;
  /** Required when creating or matching. Snapshot kept verbatim on Order. */
  counterpartyName: string;
  /** Optional. Canonicalized internally; "123-45-67890" → "1234567890". */
  bizRegNo?: string | null;
  /** Default `BOTH`. Used only when a new master is created. */
  type?: "CUSTOMER" | "SUPPLIER" | "BOTH";
}

export interface ResolveResult {
  counterpartyId: string;
  /** True when a new ErpCounterparty row was inserted. */
  created: boolean;
  /** True when an existing master was matched by bizRegNo or normalizedName. */
  matched: boolean;
  /**
   * WI-726: fallback coaCode (ErpCounterparty.defaultCoaCode) so the
   * coaCode resolver in the same `$transaction` doesn't need a second
   * read against the counterparty. Null when the master has no default.
   */
  defaultCoaCode: string | null;
}

/**
 * Find-or-create an ErpCounterparty for a write path. Always returns an id
 * suitable for `Order.counterpartyId` under the now-VALID FK.
 */
export async function resolveOrCreateCounterparty(
  tx: CounterpartyTxClient,
  input: ResolveInput,
): Promise<ResolveResult> {
  if (!input.counterpartyName || input.counterpartyName.trim().length === 0) {
    throw new CounterpartyResolutionError(
      "COUNTERPARTY_NAME_REQUIRED",
      "counterpartyName is required",
    );
  }

  // (1) Explicit id from the UI — verify only.
  if (input.counterpartyId) {
    const existing = await tx.erpCounterparty.findFirst({
      where: { id: input.counterpartyId, orgId: input.orgId, deletedAt: null },
      select: { id: true, defaultCoaCode: true },
    });
    if (!existing) {
      throw new CounterpartyResolutionError(
        "COUNTERPARTY_NOT_IN_TENANT",
        `counterparty ${input.counterpartyId} is not in this tenant`,
      );
    }
    return {
      counterpartyId: existing.id,
      created: false,
      matched: true,
      defaultCoaCode: existing.defaultCoaCode,
    };
  }

  const canonicalBizReg = canonicalizeBizRegNo(input.bizRegNo ?? null);
  const normalizedName = normalizeCounterpartyName(input.counterpartyName);

  // (2) bizRegNo — strongest signal. The partial unique index guarantees at
  //     most one row per (orgId, bizRegNo) so findFirst is deterministic.
  if (canonicalBizReg) {
    const byBizReg = await tx.erpCounterparty.findFirst({
      where: {
        orgId: input.orgId,
        bizRegNo: canonicalBizReg,
        deletedAt: null,
      },
      select: { id: true, defaultCoaCode: true },
    });
    if (byBizReg) {
      return {
        counterpartyId: byBizReg.id,
        created: false,
        matched: true,
        defaultCoaCode: byBizReg.defaultCoaCode,
      };
    }
  }

  // (3) normalizedName — only when unambiguous.
  if (normalizedName.length > 0) {
    const candidates = await tx.erpCounterparty.findMany({
      where: {
        orgId: input.orgId,
        normalizedName,
        deletedAt: null,
      },
      select: { id: true, bizRegNo: true, defaultCoaCode: true },
      take: 2, // we only care about "exactly one" — no need to fetch more
    });
    if (candidates.length === 1) {
      // If both candidate and caller carry a bizRegNo and they differ, treat
      // it as ambiguous (different business with same display name) and fall
      // through to creation. The partial-unique check already ruled out
      // collision on (orgId, bizRegNo) above.
      const c = candidates[0];
      if (
        !canonicalBizReg ||
        !c.bizRegNo ||
        c.bizRegNo === canonicalBizReg
      ) {
        return {
          counterpartyId: c.id,
          created: false,
          matched: true,
          defaultCoaCode: c.defaultCoaCode,
        };
      }
    }
  }

  // (4) Create.
  const created = await tx.erpCounterparty.create({
    data: {
      orgId: input.orgId,
      name: input.counterpartyName.trim(),
      normalizedName,
      bizRegNo: canonicalBizReg,
      type: input.type ?? DEFAULT_TYPE,
    },
    select: { id: true },
  });
  // Newly created masters have no defaultCoaCode yet — operators set it
  // later via the CRUD UI (WI-722).
  return {
    counterpartyId: created.id,
    created: true,
    matched: false,
    defaultCoaCode: null,
  };
}

/**
 * Type-erased helper for callers that hand us the top-level prisma client
 * outside a transaction. They get the same semantics; useful for tests.
 */
export async function resolveOrCreateCounterpartyWithClient(
  client: Pick<PrismaClient, "erpCounterparty">,
  input: ResolveInput,
): Promise<ResolveResult> {
  return resolveOrCreateCounterparty(
    client as unknown as CounterpartyTxClient,
    input,
  );
}
