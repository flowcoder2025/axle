/**
 * /erp/intake — Intake draft list (Server Component).
 *
 * Auth: requires `erp:read` scope on the active tenant. Failures throw and
 * surface via the shared `error.tsx` boundary (same convention as
 * /erp/products).
 *
 * URL state: `?status=PENDING|CONFIRMED|DISCARDED` filters the list. Absent
 * (or invalid) value shows all statuses.
 */

import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@axle/db";
import { Button } from "@axle/ui";
import { Plus } from "lucide-react";
import { requireErpScope } from "@/lib/erp/auth";
import { IntakeList, type IntakeListItem } from "@/src/components/erp/intake/intake-list";

export const metadata = {
  title: "영수증 등록 | AXLE",
};

const VALID_STATUSES = ["PENDING", "CONFIRMED", "DISCARDED"] as const;
type DraftStatusFilter = (typeof VALID_STATUSES)[number];

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function ErpIntakeListPage({ searchParams }: PageProps) {
  const ctx = await requireErpScope("erp:read");
  const { status: statusRaw } = await searchParams;
  const status: DraftStatusFilter | undefined = VALID_STATUSES.includes(
    statusRaw as DraftStatusFilter,
  )
    ? (statusRaw as DraftStatusFilter)
    : undefined;

  const where: Prisma.IntakeDraftWhereInput = {
    orgId: ctx.orgId,
    ...(status ? { status } : {}),
  };

  const drafts = await prisma.intakeDraft.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      blobUrl: true,
      parsedJson: true,
      confirmedOrderId: true,
      createdAt: true,
    },
  });

  const items: IntakeListItem[] = drafts.map((d) => ({
    id: d.id,
    status: d.status,
    blobUrl: d.blobUrl,
    parsed: d.parsedJson as IntakeListItem["parsed"],
    confirmedOrderId: d.confirmedOrderId,
    createdAt: d.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">영수증 등록</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            업로드된 영수증을 OCR로 분석하고 주문/재고로 확정합니다.
          </p>
        </div>
        <Link href="/erp/intake/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />새 영수증
          </Button>
        </Link>
      </div>

      <IntakeList items={items} currentStatus={status} />
    </div>
  );
}
