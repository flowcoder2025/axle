import { notFound } from "next/navigation";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { Prisma } from "@prisma/client";
import { Suspense } from "react";
import { DocumentTable } from "../../../src/components/documents/document-table";
import { DocumentUpload } from "../../../src/components/documents/document-upload";

export const metadata = {
  title: "서류 관리 | AXLE",
};

type DocCategory = "INPUT" | "OUTPUT" | "TEMPLATE" | "ISSUED";
type OcrStatus = "NONE" | "PROCESSING" | "COMPLETED" | "FAILED";

const VALID_CATEGORIES: DocCategory[] = ["INPUT", "OUTPUT", "TEMPLATE", "ISSUED"];
const VALID_OCR_STATUSES: OcrStatus[] = ["NONE", "PROCESSING", "COMPLETED", "FAILED"];

interface SearchParams {
  clientId?: string;
  category?: string;
  ocrStatus?: string;
  page?: string;
  pageSize?: string;
}

interface DocumentsPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const user = await getCurrentUser();
  if (!user?.orgId) notFound();

  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize ?? "20") || 20));
  const skip = (page - 1) * pageSize;

  const clientId = params.clientId?.trim() || undefined;
  const category = VALID_CATEGORIES.includes(params.category as DocCategory)
    ? (params.category as DocCategory)
    : undefined;
  const ocrStatus = VALID_OCR_STATUSES.includes(params.ocrStatus as OcrStatus)
    ? (params.ocrStatus as OcrStatus)
    : undefined;

  const where: Prisma.DocumentWhereInput = {
    client: { orgId: user.orgId },
    ...(clientId ? { clientId } : {}),
    ...(category ? { category } : {}),
    ...(ocrStatus ? { ocrStatus } : {}),
  };

  const [documents, total, clients] = await Promise.all([
    prisma.document.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        fileType: true,
        category: true,
        ocrStatus: true,
        expiresAt: true,
        autoRenew: true,
        version: true,
        createdAt: true,
        clientId: true,
        client: { select: { id: true, name: true } },
      },
    }),
    prisma.document.count({ where }),
    prisma.client.findMany({
      where: { orgId: user.orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const serializedDocuments = documents.map((d) => ({
    ...d,
    category: d.category as DocCategory,
    ocrStatus: d.ocrStatus as OcrStatus,
    expiresAt: d.expiresAt ? d.expiresAt.toISOString() : null,
    createdAt: d.createdAt.toISOString(),
    autoRenew: d.autoRenew ?? false,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">서류 관리</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            고객사 서류를 업로드하고 관리합니다.
          </p>
        </div>
        <DocumentUpload clients={clients} />
      </div>

      <Suspense
        fallback={
          <div className="py-8 text-center text-muted-foreground">
            불러오는 중...
          </div>
        }
      >
        <DocumentTable
          documents={serializedDocuments}
          total={total}
          page={page}
          pageSize={pageSize}
          clients={clients}
          currentClientId={params.clientId}
          currentCategory={params.category}
          currentOcrStatus={params.ocrStatus}
        />
      </Suspense>
    </div>
  );
}
