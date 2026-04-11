import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { sendEmail, matchingDigestEmail } from "@axle/email";
import { verifyCronAuth } from "@/lib/cron-auth";
import { handleInternalError } from "@/lib/api-helpers";

// POST /api/cron/daily-digest
// Scheduled: 0 8 * * 1-5 (weekdays at 08:00 UTC)
// Aggregate per consultant:
//   - today's program deadlines (from MatchingResults with upcoming applicationEnd)
//   - new matching results (created today)
//   - pending action items (Notification type ACTION_ITEM_DUE)
// Send digest email to each consultant.
export async function POST(request: Request): Promise<Response> {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Gather all consultant users (users with at least one membership)
    const consultants = await prisma.user.findMany({
      where: { memberships: { some: {} } },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    let processed = 0;

    for (const consultant of consultants) {
      if (!consultant.email) continue;

      // 1. Today's deadlines: active clients assigned to this consultant
      //    with programs whose applicationEnd is within 7 days
      const assignedClients = await prisma.client.findMany({
        where: { assignedToId: consultant.id, status: "ACTIVE" },
        select: { id: true, name: true },
      });
      const clientIds = assignedClients.map((c) => c.id);
      const clientNameMap = new Map(assignedClients.map((c) => [c.id, c.name]));

      const upcomingMatches = await prisma.matchingResult.findMany({
        where: {
          clientId: { in: clientIds },
          score: { gt: 50 },
          program: { applicationEnd: { gte: now, lte: in7Days } },
        },
        include: {
          program: { select: { name: true, applicationEnd: true } },
        },
        orderBy: { program: { applicationEnd: "asc" } },
        take: 10,
      });

      // 2. New matching results created today
      const newMatchesToday = await prisma.matchingResult.findMany({
        where: {
          clientId: { in: clientIds },
          createdAt: { gte: todayStart, lt: todayEnd },
        },
        include: {
          program: { select: { name: true } },
        },
        orderBy: { score: "desc" },
        take: 5,
      });

      // 3. Pending action items
      const pendingActionCount = await prisma.notification.count({
        where: {
          userId: consultant.id,
          type: { in: ["ACTION_ITEM", "ACTION_ITEM_DUE"] },
          isRead: false,
        },
      });

      // Build digest only if there's something to report
      const hasContent =
        upcomingMatches.length > 0 || newMatchesToday.length > 0 || pendingActionCount > 0;
      if (!hasContent) continue;

      const matches = [
        ...upcomingMatches.map((m) => {
          const daysLeft = Math.ceil(
            (m.program.applicationEnd!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          const clientName = clientNameMap.get(m.clientId) ?? "";
          return {
            programName: m.program.name,
            score: Number(m.score),
            reason: `${clientName} — 마감 D-${daysLeft}`,
          };
        }),
        ...newMatchesToday.map((m) => {
          const clientName = clientNameMap.get(m.clientId) ?? "";
          return {
            programName: m.program.name,
            score: Number(m.score),
            reason: `${clientName} — 오늘 새 매칭 결과`,
          };
        }),
      ].slice(0, 10);

      const html = matchingDigestEmail({
        consultantName: consultant.name ?? "컨설턴트",
        matches,
      });

      const pendingNote =
        pendingActionCount > 0 ? ` / 미완료 액션 ${pendingActionCount}건` : "";
      const subject = `[AXLE 일일 요약] 마감 ${upcomingMatches.length}건 · 신규 매칭 ${newMatchesToday.length}건${pendingNote}`;

      await sendEmail({
        to: consultant.email,
        subject,
        html,
      }).catch((err: unknown) => {
        console.error(`daily-digest: email failed for user ${consultant.id}`, err);
      });

      processed++;
    }

    return NextResponse.json({ success: true, processed });
  } catch (err) {
    return handleInternalError(err);
  }
}
