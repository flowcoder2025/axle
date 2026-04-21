import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import { HwpxTemplatesTable } from "./templates-table";

export const dynamic = "force-dynamic";

export default async function HwpxTemplatesPage() {
  await requirePlatformAdmin();

  const templates = await prisma.hwpxTemplate.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      org: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  const rows = templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    version: t.version,
    orgName: t.org?.name ?? null,
    createdByName: t.createdBy?.name ?? t.createdBy?.email ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    fieldMap: t.fieldMap as Record<string, unknown>,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">HWPX 템플릿 관리</h1>
        <p className="text-sm text-muted-foreground">
          정부 지원사업 양식 템플릿을 업로드하고 필드 매핑을 관리합니다.
        </p>
      </div>
      <HwpxTemplatesTable templates={rows} />
    </div>
  );
}
