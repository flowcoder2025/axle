import { notFound } from "next/navigation";
import Image from "next/image";
import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from "@axle/ui";
import { UserRowActions } from "../user-row-actions";

type Props = {
  params: Promise<{ userId: string }>;
};

export default async function UserDetailPage({ params }: Props) {
  const currentUser = await requirePlatformAdmin();
  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      platformRole: true,
      isActive: true,
      createdAt: true,
      memberships: {
        select: {
          role: true,
          organization: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  if (!user) notFound();

  const recentEvents = await prisma.analyticsEvent.findMany({
    where: {
      userId,
      category: { in: ["BUSINESS", "FEATURE_USE"] },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      action: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{user.name ?? user.email}</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Profile card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">프로필</CardTitle>
              <UserRowActions
                userId={user.id}
                currentUserId={currentUser.id}
                platformRole={user.platformRole}
                isActive={user.isActive}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {user.image && (
              <Image
                src={user.image}
                alt={user.name ?? ""}
                width={64}
                height={64}
                className="h-16 w-16 rounded-full"
              />
            )}
            <div>
              <dt className="text-xs text-muted-foreground">역할</dt>
              <dd className="mt-1">
                {user.platformRole === "PLATFORM_ADMIN" ? (
                  <Badge>플랫폼 관리자</Badge>
                ) : (
                  <Badge variant="secondary">일반</Badge>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">상태</dt>
              <dd className="mt-1">
                {user.isActive ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 text-emerald-600"
                  >
                    활성
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-red-500/30 text-red-600">
                    비활성
                  </Badge>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">가입일</dt>
              <dd className="mt-1">{new Date(user.createdAt).toLocaleString("ko-KR")}</dd>
            </div>
          </CardContent>
        </Card>

        {/* Orgs card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">소속 조직</CardTitle>
          </CardHeader>
          <CardContent>
            {user.memberships.length === 0 ? (
              <p className="text-sm text-muted-foreground">소속 조직이 없습니다</p>
            ) : (
              <ul className="space-y-2">
                {user.memberships.map((m) => (
                  <li
                    key={m.organization.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <p className="font-medium">{m.organization.name}</p>
                      <p className="text-xs text-muted-foreground">{m.organization.slug}</p>
                    </div>
                    <Badge variant="outline">{m.role}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">최근 활동 (최근 50건)</CardTitle>
          </CardHeader>
          <CardContent>
            {recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">최근 활동이 없습니다</p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">액션</th>
                      <th className="pb-2 font-medium">시간</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentEvents.map((e) => (
                      <tr key={e.id} className="border-b border-border/50 last:border-0">
                        <td className="py-2">
                          <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs">
                            {e.action}
                          </span>
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {new Date(e.createdAt).toLocaleString("ko-KR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
