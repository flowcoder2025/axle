import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { create, sendTelegramToDefault } from "@axle/notification";
import { sendEmail, deadlineAlertEmail } from "@axle/email";
import { verifyCronAuth } from "@/lib/cron-auth";
import { handleInternalError } from "@/lib/api-helpers";
import { eventBus } from "@/lib/events/event-bus";

// POST /api/cron/deadline-alert
// Scheduled: 0 8 * * * (daily at 08:00 UTC)
// Find ProgramInfo where applicationEnd between now and now+30days.
// Find MatchingResults for those programs where score > 50.
// Notify assigned consultants (Notification DEADLINE + Telegram for D-7).
export async function POST(request: Request): Promise<Response> {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const programs = await prisma.programInfo.findMany({
      where: {
        applicationEnd: { gte: now, lte: in30Days },
      },
      select: { id: true, name: true, applicationEnd: true },
    });

    if (programs.length === 0) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    const programIds = programs.map((p) => p.id);
    const programMap = new Map(programs.map((p) => [p.id, p]));

    const matchingResults = await prisma.matchingResult.findMany({
      where: {
        programId: { in: programIds },
        score: { gt: 50 },
      },
      include: {
        program: {
          select: { id: true, name: true, applicationEnd: true },
        },
      },
    });

    let processed = 0;

    for (const result of matchingResults) {
      const program = programMap.get(result.programId) ?? result.program;
      if (!program?.applicationEnd) continue;

      const daysRemaining = Math.ceil(
        (program.applicationEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      const deadline = program.applicationEnd.toLocaleDateString("ko-KR");

      // Find the client to get consultant (assignedToId)
      const client = await prisma.client.findFirst({
        where: { id: result.clientId },
        select: { id: true, name: true, email: true, assignedToId: true },
      });

      if (!client) continue;

      const consultantId = client.assignedToId;

      // Emit DEADLINE_APPROACHING on the typed event bus. Requires a
      // Project for the client to satisfy the EventMap contract; if none
      // exists we still keep the existing Notification/Telegram path.
      if (consultantId) {
        const project = await prisma.project.findFirst({
          where: { clientId: client.id },
          select: { id: true },
          orderBy: { createdAt: "desc" },
        });

        if (project) {
          eventBus
            .emit("DEADLINE_APPROACHING", {
              projectId: project.id,
              deadlineAt: program.applicationEnd,
              assigneeIds: [consultantId],
            })
            .catch((err: unknown) => {
              console.error(
                `deadline-alert: DEADLINE_APPROACHING emit failed for program ${program.id}`,
                err,
              );
            });
        }
      }

      if (consultantId) {
        await create({
          userId: consultantId,
          type: "DEADLINE",
          title: `마감 임박: ${program.name} (D-${daysRemaining})`,
          body: `${client.name} 고객의 매칭 프로그램 마감일이 ${daysRemaining}일 남았습니다.`,
          link: `/programs/${program.id}`,
        }).catch((err: unknown) => {
          console.error(`deadline-alert: notification failed for result ${result.id}`, err);
        });

        // D-7 Telegram alert
        if (daysRemaining <= 7) {
          const message =
            `📅 <b>마감 D-${daysRemaining} 알림</b>\n` +
            `프로그램: ${program.name}\n` +
            `고객: ${client.name}\n` +
            `마감일: ${deadline}`;
          await sendTelegramToDefault(message).catch((err: unknown) => {
            console.error(`deadline-alert: telegram failed for result ${result.id}`, err);
          });
        }
      }

      // Send email to consultant if we can resolve their email
      if (consultantId && client.email) {
        const html = deadlineAlertEmail({
          programName: program.name,
          deadline,
          daysRemaining,
          clientName: client.name,
        });
        await sendEmail({
          to: client.email,
          subject: `[마감 알림] ${program.name} — D-${daysRemaining}`,
          html,
        }).catch((err: unknown) => {
          console.error(`deadline-alert: email failed for result ${result.id}`, err);
        });
      }

      processed++;
    }

    // ── ActionItem due-soon sweep ─────────────────────────────────────────
    // Emit ACTION_ITEM_DUE for any OPEN action item whose dueDate falls in
    // the next 7 days. This runs alongside the program deadline sweep so
    // cron ops stay co-located.
    const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const dueItems = await prisma.actionItem.findMany({
      where: {
        status: "OPEN",
        dueDate: { gte: now, lte: in7Days },
        assigneeUserId: { not: null },
      },
      select: {
        id: true,
        assigneeUserId: true,
        dueDate: true,
        meeting: { select: { projectId: true } },
      },
    });

    let actionItemsProcessed = 0;
    for (const item of dueItems) {
      if (!item.assigneeUserId || !item.dueDate || !item.meeting?.projectId) {
        continue;
      }
      eventBus
        .emit("ACTION_ITEM_DUE", {
          actionItemId: item.id,
          projectId: item.meeting.projectId,
          assigneeId: item.assigneeUserId,
          dueAt: item.dueDate,
        })
        .catch((err: unknown) => {
          console.error(
            `deadline-alert: ACTION_ITEM_DUE emit failed for ${item.id}`,
            err,
          );
        });
      actionItemsProcessed++;
    }

    return NextResponse.json({
      success: true,
      processed,
      actionItemsProcessed,
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
