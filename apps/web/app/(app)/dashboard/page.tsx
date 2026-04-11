import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@axle/ui";
import { ExpiringDocumentsWidget } from "../../../src/components/documents/expiring-documents-widget";

export const metadata = {
  title: "Dashboard | AXLE",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const orgId = user?.orgId;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [projectCount, clientCount, meetingCount, pendingDocs] = orgId
    ? await Promise.all([
        prisma.project.count({
          where: {
            client: { orgId },
            status: { not: "COMPLETED" },
          },
        }),
        prisma.client.count({
          where: { orgId, status: "ACTIVE" },
        }),
        prisma.meeting.count({
          where: {
            client: { orgId },
            date: { gte: startOfMonth, lte: endOfMonth },
          },
        }),
        prisma.checklistItem.count({
          where: {
            project: { client: { orgId } },
            status: "PENDING",
          },
        }),
      ])
    : [0, 0, 0, 0];

  const STAT_CARDS = [
    { title: "활성 프로젝트", value: String(projectCount), description: "진행 중인 프로젝트" },
    { title: "등록 고객", value: String(clientCount), description: "전체 고객 수" },
    { title: "이번 달 미팅", value: String(meetingCount), description: "예정된 미팅 수" },
    { title: "미결 서류", value: String(pendingDocs), description: "검토 대기 중인 서류" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          안녕하세요{user?.name ? `, ${user.name}님` : ""}
        </h1>
        <p className="text-muted-foreground mt-1">
          AXLE 컨설팅 자동화 플랫폼에 오신 것을 환영합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <CardDescription>{card.title}</CardDescription>
              <CardTitle className="text-3xl">{card.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ExpiringDocumentsWidget />
      </div>
    </div>
  );
}
