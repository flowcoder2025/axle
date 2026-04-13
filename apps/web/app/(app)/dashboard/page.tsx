import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@axle/ui";
import Link from "next/link";
import { ExpiringDocumentsWidget } from "../../../src/components/documents/expiring-documents-widget";
import { UpcomingMeetingsWidget } from "../../../src/components/dashboard/upcoming-meetings-widget";
import { DeadlineProjectsWidget } from "../../../src/components/dashboard/deadline-projects-widget";
import { RecentActivityWidget } from "../../../src/components/dashboard/recent-activity-widget";

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
    { title: "활성 프로젝트", value: String(projectCount), description: "진행 중인 프로젝트", href: "/projects" },
    { title: "등록 고객", value: String(clientCount), description: "전체 고객 수", href: "/clients" },
    { title: "이번 달 미팅", value: String(meetingCount), description: "예정된 미팅 수", href: "/meetings" },
    { title: "미결 서류", value: String(pendingDocs), description: "검토 대기 중인 서류", href: "/documents" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          안녕하세요{user?.name ? `, ${user.name}님` : ""}
        </h1>
        <p className="text-muted-foreground mt-1">
          오늘의 현황을 확인하세요.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((card) => (
          <Link key={card.title} href={card.href} className="block">
            <Card className="border bg-card transition-colors hover:border-primary/50 hover:bg-accent/50">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium uppercase tracking-wider">
                  {card.title}
                </CardDescription>
                <CardTitle className="text-3xl font-bold">{card.value}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ExpiringDocumentsWidget />
        <UpcomingMeetingsWidget />
        <DeadlineProjectsWidget />
        <RecentActivityWidget />
      </div>
    </div>
  );
}
