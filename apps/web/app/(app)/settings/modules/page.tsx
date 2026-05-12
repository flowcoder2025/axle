import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@axle/ui";
import { requireOrgAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import {
  PACK_CATALOG,
  summarize,
  formatPrice,
} from "@/src/lib/module-catalog";
import { PackCard } from "@/src/components/settings/pack-card";

export const metadata = {
  title: "Pack 카탈로그 | AXLE",
};

async function loadInstalledModules(orgId: string): Promise<string[]> {
  const rows = await prisma.orgModuleInstall.findMany({
    where: { orgId },
    select: { moduleId: true },
  });
  return rows.map((r) => r.moduleId);
}

export default async function PackCatalogPage() {
  let user;
  try {
    user = await requireOrgAdmin();
  } catch (err) {
    if (isRedirectError(err)) throw err;
    // requireOrgAdmin throws Error("FORBIDDEN") for non-admins; redirect them
    // to the org settings page so they at least see *something* in /settings.
    redirect("/settings/organization");
  }

  const installedModules = await loadInstalledModules(user.orgId);
  const installedSet = new Set(installedModules);
  const summary = summarize(installedModules);

  return (
    <div className="max-w-6xl space-y-6" data-testid="pack-catalog-page">
      <div>
        <h1 className="text-2xl font-bold">Pack 카탈로그</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          6개 Pack · 35개 모듈. 조직 관리자가 install/uninstall합니다.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="summary-active-packs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">활성 Pack</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.activePackCount}</p>
          </CardContent>
        </Card>
        <Card data-testid="summary-active-modules">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">활성 모듈</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {summary.activeModuleCount}
            </p>
          </CardContent>
        </Card>
        <Card data-testid="summary-monthly-total">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">월 청구액</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-semibold">
              {formatPrice(summary.monthlyTotal)}
            </p>
          </CardContent>
        </Card>
        <Card data-testid="summary-managed-orgs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">관리 조직</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.managedOrgCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tenancy Tier placeholder (WI-620 will wire this up) */}
      <Card
        data-testid="tenancy-tier-section"
        className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100"
      >
        <CardHeader>
          <CardTitle className="text-lg">★ Tenancy Tier (별도 요금제)</CardTitle>
          <CardDescription>
            이 플랫폼에서 자기 조직 1개만 관리할지, 여러 조직을 위탁 관리할지
            선택합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border-2 border-blue-600 bg-white p-4">
              <p className="font-semibold">Single-org (default)</p>
              <p className="mt-1 text-xs text-muted-foreground">
                자기 조직 1개 관리. 모든 모듈이 자기 조직 데이터로 동작.
              </p>
              <p className="mt-2 font-mono text-xs">무료 (Pack 가격만)</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-white/70 p-4">
              <div className="flex items-center gap-2">
                <p className="font-semibold">Multi-org</p>
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                  Premium
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                자기 조직 + N개 관리 조직. 적용 모듈: 재무/분석(A) · AI매칭/연구일지(B) · HR 전체(D).
              </p>
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                ₩? base + 관리 조직 1개당 ₩? (TBD)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pack grid */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Pack 카탈로그 (6개)</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PACK_CATALOG.map((pack) => (
            <PackCard
              key={pack.id}
              pack={pack}
              installedModules={installedSet}
            />
          ))}
        </div>
      </div>

      {/* Individual module install hint */}
      <Card data-testid="individual-modules-section">
        <CardHeader>
          <CardTitle className="text-base">개별 모듈 install</CardTitle>
          <CardDescription>
            Pack 단위가 아닌 개별 모듈만 install — 35개 중 원하는 것만 골라 사용.
            Pack 가격보다 비싸지만 진짜 필요한 것만 결제.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            상세 UI는 WI-619 (ReBAC) + 결제 시스템 합류 후 활성화됩니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
