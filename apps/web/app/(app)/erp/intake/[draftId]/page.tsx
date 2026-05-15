/**
 * /erp/intake/[draftId] — Receipt review page (Server Component).
 *
 * Auth: requires `erp:read` scope on the active tenant. Failures throw and
 * surface via the shared `error.tsx` boundary (same convention as the rest
 * of /erp/*).
 *
 * Tenant scope: `findFirst` with `orgId: ctx.orgId` is the access guard —
 * cross-tenant draftIds simply look like "not found". We never leak the
 * existence of another org's draft.
 */

import { notFound } from "next/navigation";
import { prisma } from "@axle/db";
import type { ReceiptData } from "@axle/ocr";
import { requireErpScope } from "@/lib/erp/auth";
import {
  IntakeReviewForm,
  type IntakeReviewFormProps,
} from "@/src/components/erp/intake/intake-review-form";

export const metadata = {
  title: "영수증 검토 | AXLE",
};

interface PageProps {
  params: Promise<{ draftId: string }>;
}

export default async function IntakeReviewPage({ params }: PageProps) {
  const ctx = await requireErpScope("erp:read");
  const { draftId } = await params;

  const draft = await prisma.intakeDraft.findFirst({
    where: { id: draftId, orgId: ctx.orgId },
    select: {
      id: true,
      blobUrl: true,
      status: true,
      parsedJson: true,
      matchSuggestions: true,
      errorMsg: true,
      confirmedOrderId: true,
    },
  });

  if (!draft) {
    notFound();
  }

  return (
    <IntakeReviewForm
      draftId={draft.id}
      blobUrl={draft.blobUrl}
      status={draft.status}
      parsed={draft.parsedJson as Partial<ReceiptData> | null}
      matchSuggestions={
        draft.matchSuggestions as IntakeReviewFormProps["matchSuggestions"]
      }
      errorMsg={draft.errorMsg}
      confirmedOrderId={draft.confirmedOrderId}
    />
  );
}
