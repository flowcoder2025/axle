import Link from "next/link";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
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

export const metadata = {
  title: "관리 조직 | AXLE",
};

export default async function ManagedOrgsPage() {
  let user;
  try {
    user = await requireOrgAdmin();
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirect("/settings/organization");
  }

  const [subscription, managedOrgs] = await Promise.all([
    prisma.orgMultiOrgSubscription.findUnique({ where: { orgId: user.orgId } }),
    prisma.managedOrg.findMany({
      where: { ownerOrgId: user.orgId },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
  ]);

  const enabled = subscription?.enabled === true;
  const activeCount = managedOrgs.filter((o) => o.status !== "TERMINATED").length;
  const maxManaged = subscription?.maxManaged ?? 0;

  return (
    <div className="max-w-5xl space-y-6" data-testid="managed-orgs-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">관리 조직</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            컨설팅 위탁 운영 중인 고객 조직 목록.
          </p>
        </div>
        {enabled && (
          <Link href="/settings/managed-orgs/new">
            <Button data-testid="add-managed-org-button">+ 추가</Button>
          </Link>
        )}
      </div>

      {!enabled && (
        <Card data-testid="multiorg-disabled-card" className="border-amber-200">
          <CardHeader>
            <CardTitle className="text-base">
              Multi-org 구독 비활성
            </CardTitle>
            <CardDescription>
              여러 고객 조직을 한 플랫폼에서 위탁 관리하려면 Multi-org tier를
              활성화해야 합니다. 결제 페이지는 별도 WI에서 추가됩니다.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {enabled && (
        <Card data-testid="multiorg-summary-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">구독 요약</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">활성 관리 조직</p>
                <p className="font-mono text-lg">
                  {activeCount}
                  {maxManaged > 0 ? ` / ${maxManaged}` : ""}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">활성 일자</p>
                <p className="font-mono text-lg">
                  {subscription?.activatedAt
                    ? new Date(subscription.activatedAt).toLocaleDateString("ko-KR")
                    : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {managedOrgs.length === 0 && enabled && (
          <Card data-testid="empty-managed-orgs">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              아직 등록된 관리 조직이 없습니다. 우측 상단 [+ 추가] 버튼으로
              시작하세요.
            </CardContent>
          </Card>
        )}
        {managedOrgs.map((org) => {
          const packs = Array.isArray(org.installedPacks)
            ? (org.installedPacks as string[])
            : [];
          return (
            <Card
              key={org.id}
              data-testid={`managed-org-card-${org.id}`}
              className={
                org.status === "TERMINATED" ? "opacity-60" : undefined
              }
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{org.name}</CardTitle>
                    {org.bizRegNumber && (
                      <CardDescription className="font-mono text-xs">
                        {org.bizRegNumber}
                      </CardDescription>
                    )}
                  </div>
                  <ManagedOrgStatusBadge status={org.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">위탁 Pack</p>
                  {packs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">없음</p>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {packs.map((p) => (
                        <Badge
                          key={p}
                          variant="outline"
                          data-testid={`pack-tag-${org.id}-${p}`}
                        >
                          Pack {p}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <Link href={`/settings/managed-orgs/${org.id}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid={`managed-org-detail-${org.id}`}
                  >
                    설정
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
