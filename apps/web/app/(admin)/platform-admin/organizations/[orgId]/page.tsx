import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@axle/ui";
import { getOrgStats } from "@/lib/admin/org-aggregator";
import { getAiJobQuotaStatus } from "@/lib/quota/ai-jobs";
import { PlanQuotaForm } from "./plan-quota-form";
import { SuspendToggle } from "./suspend-toggle";
import { OrgDetailTabs } from "./org-detail-tabs";

type Props = {
  params: Promise<{ orgId: string }>;
};

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
};

export default async function OrgDetailPage({ params }: Props) {
  await requirePlatformAdmin();
  const { orgId } = await params;

  const [org, stats, aiQuota] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        plan: true,
        quotaAiJobs: true,
        quotaMembers: true,
        isSuspended: true,
        createdAt: true,
        memberships: {
          select: {
            role: true,
            createdAt: true,
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    getOrgStats(orgId),
    getAiJobQuotaStatus(orgId).catch(() => null),
  ]);

  if (!org) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <p className="text-sm text-muted-foreground">{org.slug}</p>
        </div>
        {org.isSuspended && (
          <Badge variant="outline" className="border-red-500/30 text-red-600">
            정지됨
          </Badge>
        )}
      </div>

      <OrgDetailTabs
        memberCount={stats.memberCount}
        overview={
          <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                  멤버
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.memberCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                  프로젝트
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.projectCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                  고객
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.clientCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                  최근 7일 이벤트
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.last7dEvents.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">기본 정보</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Slug</dt>
                <dd className="mt-1">{org.slug}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">생성일</dt>
                <dd className="mt-1">{new Date(org.createdAt).toLocaleString("ko-KR")}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">플랜</dt>
                <dd className="mt-1">
                  <Badge variant="outline">{PLAN_LABEL[org.plan] ?? org.plan}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">상태</dt>
                <dd className="mt-1">
                  {org.isSuspended ? (
                    <Badge variant="outline" className="border-red-500/30 text-red-600">
                      정지
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/30 text-emerald-600"
                    >
                      정상
                    </Badge>
                  )}
                </dd>
              </div>
            </CardContent>
          </Card>
          </div>
        }
        members={
          <Card>
            <CardHeader>
              <CardTitle className="text-base">멤버 목록</CardTitle>
            </CardHeader>
            <CardContent>
              {org.memberships.length === 0 ? (
                <p className="text-sm text-muted-foreground">멤버가 없습니다</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead>이메일</TableHead>
                      <TableHead>역할</TableHead>
                      <TableHead>가입일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {org.memberships.map((m) => (
                      <TableRow key={m.user.id}>
                        <TableCell className="font-medium">
                          {m.user.name ?? "(이름 없음)"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{m.user.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{m.role}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(m.createdAt).toLocaleDateString("ko-KR")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        }
        plan={
          <Card>
            <CardHeader>
              <CardTitle className="text-base">플랜 / 쿼터 설정</CardTitle>
            </CardHeader>
            <CardContent>
              <PlanQuotaForm
                orgId={org.id}
                plan={org.plan}
                quotaAiJobs={org.quotaAiJobs}
                quotaMembers={org.quotaMembers}
                usage={{
                  aiJobsThisMonth: aiQuota?.used ?? 0,
                  members: stats.memberCount,
                }}
              />
            </CardContent>
          </Card>
        }
        manage={
          <Card>
            <CardHeader>
              <CardTitle className="text-base">조직 관리</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-red-500/20 p-4">
                <h3 className="font-medium text-red-700">조직 정지</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  정지된 조직의 멤버는 로그인 및 플랫폼 접근이 차단됩니다.
                </p>
                <div className="mt-3">
                  <SuspendToggle orgId={org.id} isSuspended={org.isSuspended} />
                </div>
              </div>
            </CardContent>
          </Card>
        }
      />
    </div>
  );
}
