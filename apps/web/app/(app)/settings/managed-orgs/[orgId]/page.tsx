import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@axle/ui";
import { requireOrgAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import { ManagedOrgStatusBadge } from "@/src/components/managed-orgs/status-badge";
import { PACK_CATALOG } from "@/src/lib/module-catalog";
import { ManagedOrgPackForm } from "@/src/components/managed-orgs/pack-form";
import { ManagedOrgStatusForm } from "@/src/components/managed-orgs/status-form";

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { orgId } = await params;
  return { title: `관리 조직 ${orgId.slice(0, 8)} | AXLE` };
}

export default async function ManagedOrgDetailPage({ params }: PageProps) {
  const { orgId } = await params;

  let user;
  try {
    user = await requireOrgAdmin();
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirect("/settings/organization");
  }

  const managed = await prisma.managedOrg.findFirst({
    where: { id: orgId, ownerOrgId: user.orgId },
  });
  if (!managed) notFound();

  const installedPacks = Array.isArray(managed.installedPacks)
    ? (managed.installedPacks as string[])
    : [];

  return (
    <div
      className="max-w-3xl space-y-6"
      data-testid={`managed-org-detail-page-${managed.id}`}
    >
      <div>
        <Link
          href="/settings/managed-orgs"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← 관리 조직
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold">{managed.name}</h1>
          <ManagedOrgStatusBadge status={managed.status} />
        </div>
        {managed.bizRegNumber && (
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            {managed.bizRegNumber}
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">위탁 Pack</CardTitle>
          <CardDescription>
            이 관리 조직에 부여할 Pack을 선택합니다. multi-org 적용 모듈만
            실제로 위탁 운영 가능합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ManagedOrgPackForm
            managedOrgId={managed.id}
            initial={installedPacks}
            allPackIds={PACK_CATALOG.map((p) => p.id)}
            disabled={managed.status === "TERMINATED"}
          />
          <div className="mt-3 flex flex-wrap gap-1">
            {installedPacks.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                현재 위탁된 Pack 없음
              </span>
            ) : (
              installedPacks.map((p) => (
                <Badge key={p} variant="outline">
                  Pack {p}
                </Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">상태</CardTitle>
          <CardDescription>
            ACTIVE / PAUSED / TERMINATED. TERMINATED 시 사이드바 스위처에서
            제외됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ManagedOrgStatusForm
            managedOrgId={managed.id}
            current={managed.status}
          />
        </CardContent>
      </Card>

      <Card data-testid="payment-placeholder">
        <CardHeader>
          <CardTitle className="text-base text-muted-foreground">
            결제 (placeholder)
          </CardTitle>
          <CardDescription>
            관리 조직별 청구 / Polar 통합은 별도 WI에서 추가됩니다.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
