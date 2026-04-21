import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import { ProjectType } from "@prisma/client";
import { ChecklistTemplateAdmin } from "@/src/components/admin/checklist-template-admin";

type Props = {
  searchParams: Promise<{
    scope?: "org" | "platform";
    projectType?: ProjectType;
  }>;
};

export const dynamic = "force-dynamic";

const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  BUSINESS_PLAN: "사업계획서",
  VENTURE_CERT: "벤처기업 확인",
  SOBOOJANG_CERT: "소부장 인증",
  RESEARCH_INSTITUTE: "기업부설연구소",
  PATENT: "특허",
  FINANCIAL_ANALYSIS: "재무 분석",
  RESEARCH_TASK: "연구 과제",
  BUNDLE: "번들",
};

export default async function ChecklistTemplatesAdminPage({
  searchParams,
}: Props) {
  const user = await requirePlatformAdmin();
  const sp = await searchParams;
  const scope: "org" | "platform" = sp.scope ?? "platform";

  const orgFilter =
    scope === "platform" ? { orgId: null } : { orgId: user.orgId };

  const templates = await prisma.checklistTemplate.findMany({
    where: {
      ...orgFilter,
      ...(sp.projectType ? { projectType: sp.projectType } : {}),
    },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: [{ projectType: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  // Group by projectType
  const grouped = new Map<ProjectType, typeof templates>();
  for (const pt of Object.values(ProjectType)) grouped.set(pt, []);
  for (const tmpl of templates) {
    grouped.get(tmpl.projectType)?.push(tmpl);
  }

  const serialized = Array.from(grouped.entries()).map(
    ([projectType, tmpls]) => ({
      projectType,
      label: PROJECT_TYPE_LABELS[projectType],
      templates: tmpls.map((t) => ({
        id: t.id,
        orgId: t.orgId,
        projectType: t.projectType,
        name: t.name,
        description: t.description,
        isRequired: t.isRequired,
        sortOrder: t.sortOrder,
        items: t.items.map((it) => ({
          id: it.id,
          name: it.name,
          description: it.description,
          isRequired: it.isRequired,
          sortOrder: it.sortOrder,
          itemType: it.itemType,
          certificateType: it.certificateType,
        })),
      })),
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">체크리스트 템플릿</h1>
        <p className="text-sm text-muted-foreground">
          프로젝트 타입별 체크리스트 템플릿을 관리합니다. 플랫폼 공용 템플릿은
          모든 조직에 노출됩니다.
        </p>
      </div>

      <ChecklistTemplateAdmin groups={serialized} currentScope={scope} />
    </div>
  );
}
