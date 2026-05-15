/**
 * /erp/orders — Order list (Server Component).
 *
 * Tabs (구매/판매/전체) wire to `?type=PURCHASE|SALE`. Status, date range
 * and counterparty search are plain GET form fields so the page stays a
 * Server Component (no client state). Pagination uses `?page=N` (50 rows
 * per page).
 *
 * Auth: `erp:read`. We hit `prisma` directly here to avoid the API hop.
 * The shape mirrors `/api/erp/orders` for parity.
 */

import Link from "next/link";
import { Prisma, OrderType, OrderStatus } from "@prisma/client";
import { prisma } from "@axle/db";
import { requireErpScope } from "@/lib/erp/auth";
import { serializeOrder } from "@/lib/erp/serialize";

export const metadata = {
  title: "주문 관리 | AXLE",
};

interface PageProps {
  searchParams: Promise<{
    type?: string;
    status?: string;
    from?: string;
    to?: string;
    q?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 50;
const VALID_TYPES = new Set<string>(["SALE", "PURCHASE"]);
const VALID_STATUSES = new Set<string>(["DRAFT", "CONFIRMED", "CANCELLED"]);

function parseDate(raw: string | undefined): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parsePage(raw: string | undefined): number {
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function statusBadge(status: string): { label: string; className: string } {
  if (status === "CONFIRMED")
    return {
      label: "확정",
      className: "bg-green-100 text-green-800",
    };
  if (status === "CANCELLED")
    return {
      label: "취소",
      className: "bg-red-100 text-red-800",
    };
  return { label: "초안", className: "bg-muted text-muted-foreground" };
}

function typeLabel(type: string): string {
  return type === "PURCHASE" ? "구매" : type === "SALE" ? "판매" : type;
}

function buildQuery(
  base: { type?: string; status?: string; from?: string; to?: string; q?: string },
  overrides: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  const merged: Record<string, string | undefined> = { ...base, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, v);
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export default async function ErpOrdersPage({ searchParams }: PageProps) {
  const ctx = await requireErpScope("erp:read");
  const params = await searchParams;

  const typeRaw = params.type?.trim() || "";
  const type =
    typeRaw && VALID_TYPES.has(typeRaw) ? (typeRaw as OrderType) : undefined;
  const statusRaw = params.status?.trim() || "";
  const status =
    statusRaw && VALID_STATUSES.has(statusRaw)
      ? (statusRaw as OrderStatus)
      : undefined;
  const fromRaw = params.from?.trim() || "";
  const toRaw = params.to?.trim() || "";
  const from = parseDate(fromRaw);
  const to = parseDate(toRaw);
  const q = params.q?.trim() || "";
  const page = parsePage(params.page);

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

  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      include: { items: { select: { id: true } } },
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.order.count({ where }),
  ]);

  const orders = rows.map((row) => {
    // Strip the include's slim `items` projection (id-only) before handing
    // off to the serializer — serializeOrder expects full OrderItem rows
    // and the list view only needs the count.
    const { items, ...rest } = row;
    return {
      ...serializeOrder(rest),
      itemCount: items.length,
    };
  });

  const tabBase = { status: statusRaw, from: fromRaw, to: toRaw, q };
  const tabs: { key: string; label: string }[] = [
    { key: "", label: "전체" },
    { key: "PURCHASE", label: "구매" },
    { key: "SALE", label: "판매" },
  ];

  const hasNext = total > (page + 1) * PAGE_SIZE;
  const hasPrev = page > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">주문 관리</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            구매 · 판매 주문을 조회하고 취소할 수 있습니다. 영수증 인테이크와 연동됩니다.
          </p>
        </div>
      </div>

      {/* Tabs (type) */}
      <div className="flex border-b">
        {tabs.map((t) => {
          const active = (typeRaw || "") === t.key;
          const href = `/erp/orders${buildQuery(tabBase, { type: t.key || undefined, page: undefined })}`;
          return (
            <Link
              key={t.key || "all"}
              href={href}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* Filter form */}
      <form
        action="/erp/orders"
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-md border bg-card p-3"
      >
        {type ? <input type="hidden" name="type" value={typeRaw} /> : null}
        <label className="flex flex-col text-xs text-muted-foreground">
          상태
          <select
            name="status"
            defaultValue={statusRaw}
            className="mt-1 h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">전체</option>
            <option value="DRAFT">초안</option>
            <option value="CONFIRMED">확정</option>
            <option value="CANCELLED">취소</option>
          </select>
        </label>
        <label className="flex flex-col text-xs text-muted-foreground">
          시작일
          <input
            type="date"
            name="from"
            defaultValue={fromRaw}
            className="mt-1 h-9 rounded-md border bg-background px-2 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs text-muted-foreground">
          종료일
          <input
            type="date"
            name="to"
            defaultValue={toRaw}
            className="mt-1 h-9 rounded-md border bg-background px-2 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs text-muted-foreground">
          거래처
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="거래처명 검색"
            className="mt-1 h-9 w-48 rounded-md border bg-background px-2 text-sm"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            className="h-9 rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted"
          >
            필터 적용
          </button>
          <Link
            href={`/erp/orders${type ? `?type=${typeRaw}` : ""}`}
            className="inline-flex h-9 items-center rounded-md border bg-background px-3 text-sm text-muted-foreground hover:bg-muted"
          >
            초기화
          </Link>
        </div>
      </form>

      {/* Table */}
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">일자</th>
              <th className="px-3 py-2">유형</th>
              <th className="px-3 py-2">거래처</th>
              <th className="px-3 py-2 text-right">품목수</th>
              <th className="px-3 py-2 text-right">총액 (KRW)</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2 text-right">액션</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  주문이 없습니다. 영수증 인테이크 또는 직접 입력으로 추가하세요.
                </td>
              </tr>
            ) : (
              orders.map((o) => {
                const badge = statusBadge(o.status);
                const date = o.occurredAt ? o.occurredAt.slice(0, 10) : "-";
                return (
                  <tr key={o.id} className="border-t">
                    <td className="px-3 py-2 tabular-nums">{date}</td>
                    <td className="px-3 py-2">{typeLabel(o.type)}</td>
                    <td className="px-3 py-2">
                      <Link
                        className="font-medium hover:underline"
                        href={`/erp/orders/${o.id}`}
                      >
                        {o.counterpartyName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{o.itemCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{o.total}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        className="text-xs text-muted-foreground hover:underline"
                        href={`/erp/orders/${o.id}`}
                      >
                        상세
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          총 {total}건 · {page * PAGE_SIZE + (orders.length > 0 ? 1 : 0)}–
          {page * PAGE_SIZE + orders.length}건 표시
        </div>
        <div className="flex gap-2">
          {hasPrev ? (
            <Link
              href={`/erp/orders${buildQuery(
                { type: typeRaw, status: statusRaw, from: fromRaw, to: toRaw, q },
                { page: String(page - 1) },
              )}`}
              className="inline-flex h-8 items-center rounded-md border bg-background px-3 text-sm hover:bg-muted"
            >
              이전
            </Link>
          ) : (
            <span className="inline-flex h-8 items-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground/60">
              이전
            </span>
          )}
          {hasNext ? (
            <Link
              href={`/erp/orders${buildQuery(
                { type: typeRaw, status: statusRaw, from: fromRaw, to: toRaw, q },
                { page: String(page + 1) },
              )}`}
              className="inline-flex h-8 items-center rounded-md border bg-background px-3 text-sm hover:bg-muted"
            >
              다음
            </Link>
          ) : (
            <span className="inline-flex h-8 items-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground/60">
              다음
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
