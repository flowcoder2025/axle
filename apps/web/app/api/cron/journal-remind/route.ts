import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { sendEmail, journalReminderEmail } from "@axle/email";
import { verifyCronAuth } from "@/lib/cron-auth";
import { handleInternalError } from "@/lib/api-helpers";
import { eventBus } from "@/lib/events/event-bus";

// POST /api/cron/journal-remind
// Scheduled: 0 9 25 * * (25th of each month at 09:00 UTC)
// Find researchers (Contact.isResearcher=true) who haven't written a
// journal this month and send a reminder email.
export async function POST(request: Request): Promise<Response> {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const monthLabel = now.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });

    // Researchers who have at least one journal this month
    const activeResearchers = await prisma.researchJournal.findMany({
      where: { date: { gte: monthStart, lte: monthEnd } },
      select: { researcherContactId: true },
      distinct: ["researcherContactId"],
    });
    const activeIds = new Set(activeResearchers.map((r) => r.researcherContactId));

    // All researchers
    const researchers = await prisma.contact.findMany({
      where: { isResearcher: true, email: { not: null } },
      select: {
        id: true,
        name: true,
        email: true,
        client: { select: { id: true, name: true } },
      },
    });

    let processed = 0;

    for (const researcher of researchers) {
      if (activeIds.has(researcher.id)) continue;
      if (!researcher.email) continue;

      const html = journalReminderEmail({
        researcherName: researcher.name,
        clientName: researcher.client.name,
        month: monthLabel,
        writeUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/journals/new`,
      });

      await sendEmail({
        to: researcher.email,
        subject: `[연구일지 알림] ${monthLabel} 연구일지를 작성해주세요`,
        html,
      }).catch((err: unknown) => {
        console.error(`journal-remind: email failed for contact ${researcher.id}`, err);
      });

      // Emit JOURNAL_DUE so downstream typed-event channels (push, in-app)
      // can fire. journalId is synthesized from the contact + month because
      // no ResearchJournal row exists yet — the reminder is precisely for
      // the missing one.
      eventBus
        .emit("JOURNAL_DUE", {
          journalId: `reminder-${researcher.id}-${now.getFullYear()}-${now.getMonth() + 1}`,
          clientId: researcher.client.id,
          dueAt: monthEnd,
        })
        .catch((err: unknown) => {
          console.error(
            `journal-remind: JOURNAL_DUE emit failed for contact ${researcher.id}`,
            err,
          );
        });

      processed++;
    }

    return NextResponse.json({ success: true, processed });
  } catch (err) {
    return handleInternalError(err);
  }
}
