/**
 * /api/erp/orders
 *
 *  GET — List orders for the active tenant (Multi-org aware).
 *
 *  Query params:
 *    type       (optional) — SALE | PURCHASE. When omitted, returns both.
 *    status     (optional) — DRAFT | CONFIRMED | CANCELLED.
 *    from       (optional) — ISO date. Lower bound on `occurredAt` (inclusive).
 *    to         (optional) — ISO date. Upper bound on `occurredAt` (inclusive).
 *    q          (optional) — Substring search over `counterpartyName`.
 *    page       (optional) — Offset pagination, 0-indexed (default 0).
 *
 *  Response:
 *    {
 *      orders: SerializedOrder[],  // page-sized slice (PAGE_SIZE = 50)
 *      total:  number,             // total rows matching the filters
 *      page:   number,             // echoed page index
 *      pageSize: number,           // PAGE_SIZE
 *      truncated: boolean,         // total > (page+1)*pageSize
 *    }
 *
 *  Items are intentionally omitted from the list payload — the detail
 *  endpoint hydrates them. This keeps the list response small enough that
 *  500-row tenants stay snappy.
 */

import { prisma } from "@axle/db";
import { Prisma, OrderType, OrderStatus } from "@prisma/client";
import { requireErpScope, toResponse } from "@/lib/erp/auth";
import { serializeOrder } from "@/lib/erp/serialize";

const PAGE_SIZE = 50;

const VALID_TYPES = new Set<string>(["SALE", "PURCHASE"]);
const VALID_STATUSES = new Set<string>(["DRAFT", "CONFIRMED", "CANCELLED"]);

function parseDateParam(raw: string | null): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parsePageParam(raw: string | null): number {
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export async function GET(req: Request): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:read");
    const url = new URL(req.url);

    const typeRaw = url.searchParams.get("type");
    const type =
      typeRaw && VALID_TYPES.has(typeRaw) ? (typeRaw as OrderType) : undefined;

    const statusRaw = url.searchParams.get("status");
    const status =
      statusRaw && VALID_STATUSES.has(statusRaw)
        ? (statusRaw as OrderStatus)
        : undefined;

    const from = parseDateParam(url.searchParams.get("from"));
    const to = parseDateParam(url.searchParams.get("to"));
    const q = url.searchParams.get("q")?.trim();
    const page = parsePageParam(url.searchParams.get("page"));

    const occurredAtFilter: Prisma.DateTimeFilter | undefined =
      from || to
        ? {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          }
        : undefined;

    const where: Prisma.OrderWhereInput = {
      orgId: ctx.orgId,
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
      ...(occurredAtFilter ? { occurredAt: occurredAtFilter } : {}),
      ...(q ? { counterpartyName: { contains: q, mode: "insensitive" } } : {}),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.order.count({ where }),
    ]);

    return Response.json({
      orders: orders.map((o) => serializeOrder(o)),
      total,
      page,
      pageSize: PAGE_SIZE,
      truncated: total > (page + 1) * PAGE_SIZE,
    });
  } catch (err) {
    return toResponse(err);
  }
}
