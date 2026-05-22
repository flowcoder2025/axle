/**
 * /erp/counterparties — ErpCounterparty list (Server Component).
 *
 * Phase 21 WI-732-feat:
 *   - Renders the list + tools (search box, type filter, "+ 신규" CTA, 중복 감지).
 *   - The interactive parts (search, modals, merge dialog) live in
 *     `<CounterpartiesView>` (Client Component) — we pass the initial
 *     rows + permission flags down so the page is renderable without
 *     any client fetch on first paint.
 *   - `canMerge` is decided on the server with `checkModulePermission`
 *     so the merge button stays hidden for users without `erp:merge`
 *     scope (RED AC #4).
 */

import { prisma } from "@axle/db";
import { checkModulePermission } from "@axle/auth";
import { requireErpScope } from "@/lib/erp/auth";
import { serializeCounterparty } from "@/lib/erp/serialize";
import { CounterpartiesView } from "@/src/components/erp/counterparties/counterparties-view";
import type { Prisma } from "@prisma/client";

export const metadata = {
  title: "거래처 관리 | AXLE",
};

const COUNTERPARTY_LIST_LIMIT = 200;

interface PageProps {
  searchParams: Promise<{ q?: string; type?: string }>;
}

export default async function ErpCounterpartiesPage({ searchParams }: PageProps) {
  const ctx = await requireErpScope("erp:read");
  const { q, type } = await searchParams;

  const where: Prisma.ErpCounterpartyWhereInput = {
    orgId: ctx.orgId,
    mergedIntoId: null,
    ...(type && type !== "ALL"
      ? { type: type as "CUSTOMER" | "SUPPLIER" | "BOTH" }
      : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { bizRegNo: { contains: q } },
          ],
        }
      : {}),
  };

  const rows = await prisma.erpCounterparty.findMany({
    where,
    orderBy: { name: "asc" },
    take: COUNTERPARTY_LIST_LIMIT,
  });
  const counterparties = rows.map(serializeCounterparty);
  const truncated = rows.length === COUNTERPARTY_LIST_LIMIT;

  // Permission-gate the destructive merge button. The merge API itself
  // double-checks via `requireErpScope("erp:merge")`, but hiding the UI
  // for users without the scope is the RED AC for this WI (spec §5 #4).
  const canMerge = await checkModulePermission(ctx.userId, ctx.orgId, "erp:merge");
  const canWrite = await checkModulePermission(ctx.userId, ctx.orgId, "erp:write");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">거래처 관리</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            한국어 fuzzy 검색 · 사업자등록번호 기준 중복 감지 · 머지 흐름을 지원합니다.
          </p>
        </div>
      </div>

      <CounterpartiesView
        initialRows={counterparties}
        truncated={truncated}
        initialQuery={q ?? ""}
        initialType={type ?? "ALL"}
        canMerge={canMerge}
        canWrite={canWrite}
      />
    </div>
  );
}
