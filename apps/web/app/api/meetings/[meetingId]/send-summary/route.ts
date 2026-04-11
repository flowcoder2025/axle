import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { sendEmail } from "@axle/email";
import { meetingSummaryEmail } from "@axle/email";
import { handleInternalError, unauthorizedResponse, notFoundResponse } from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ meetingId: string }> };

// POST /api/meetings/[meetingId]/send-summary — send meeting summary email to all attendees
export async function POST(_req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const { meetingId } = await ctx.params;

    // Fetch meeting with attendees, transcript, and action items
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, client: { orgId: user.orgId } },
      select: {
        id: true,
        title: true,
        date: true,
        clientId: true,
        attendees: {
          select: {
            name: true,
            contactId: true,
            userId: true,
          },
        },
        transcript: {
          select: { summary: true },
        },
        actionItems: {
          where: { status: { not: "DONE" } },
          select: { description: true, status: true },
          orderBy: { status: "asc" },
        },
      },
    });

    if (!meeting) return notFoundResponse("Meeting");

    // Collect attendee emails from Contact or User
    const recipientEmails: string[] = [];

    // Gather contactIds and userIds
    const contactIds = meeting.attendees
      .map((a) => a.contactId)
      .filter((id): id is string => id != null);
    const userIds = meeting.attendees
      .map((a) => a.userId)
      .filter((id): id is string => id != null);

    const [contacts, users] = await Promise.all([
      contactIds.length > 0
        ? prisma.contact.findMany({
            where: { id: { in: contactIds } },
            select: { email: true },
          })
        : Promise.resolve([]),
      userIds.length > 0
        ? prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { email: true },
          })
        : Promise.resolve([]),
    ]);

    for (const c of contacts) {
      if (c.email) recipientEmails.push(c.email);
    }
    for (const u of users) {
      recipientEmails.push(u.email);
    }

    // Deduplicate emails to avoid sending multiple copies
    const uniqueEmails = [...new Set(recipientEmails)];

    if (uniqueEmails.length === 0) {
      return NextResponse.json(
        { error: { code: "NO_RECIPIENTS", message: "No attendee emails found" } },
        { status: 422 }
      );
    }

    // Build email content
    const dateStr = meeting.date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const attendeeNames = meeting.attendees.map((a) => a.name);
    const actionItemDescriptions = meeting.actionItems.map((ai) => ai.description);
    const summary = meeting.transcript?.summary ?? "요약 없음";
    const subject = `[미팅 요약] ${meeting.title} (${dateStr})`;

    const html = meetingSummaryEmail({
      meetingTitle: meeting.title,
      date: dateStr,
      attendees: attendeeNames,
      summary,
      actionItems: actionItemDescriptions,
    });

    // Send emails and create EmailLog records
    let sent = 0;
    const sendResults = await Promise.allSettled(
      uniqueEmails.map(async (email) => {
        const result = await sendEmail({ to: email, subject, html });
        return { email, resendMessageId: result.id };
      })
    );

    const emailLogData: Array<{
      meetingId: string;
      clientId: string;
      to: string;
      subject: string;
      type: "MEETING_SUMMARY";
      channel: string;
      resendMessageId: string | null;
    }> = [];

    for (const result of sendResults) {
      if (result.status === "fulfilled") {
        sent++;
        emailLogData.push({
          meetingId: meeting.id,
          clientId: meeting.clientId,
          to: result.value.email,
          subject,
          type: "MEETING_SUMMARY",
          channel: "email",
          resendMessageId: result.value.resendMessageId,
        });
      }
    }

    if (emailLogData.length > 0) {
      await prisma.emailLog.createMany({ data: emailLogData });
    }

    return NextResponse.json({ data: { sent } });
  } catch (err) {
    return handleInternalError(err);
  }
}
