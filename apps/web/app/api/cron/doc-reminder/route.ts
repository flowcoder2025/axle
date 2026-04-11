import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { create } from "@axle/notification";
import { sendEmail, docRequestEmail } from "@axle/email";
import { verifyCronAuth } from "@/lib/cron-auth";
import { handleInternalError } from "@/lib/api-helpers";

// POST /api/cron/doc-reminder
// Scheduled: 0 9 * * * (daily at 09:00 UTC)
// Find ChecklistItems where status=REQUESTED, requestedAt < now-3days,
// and project.status IN [DOC_COLLECTING, IN_PROGRESS].
// Send reminder email/SMS and create DOC_REQUESTED notification.
export async function POST(request: Request): Promise<Response> {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const items = await prisma.checklistItem.findMany({
      where: {
        status: "REQUESTED",
        requestedAt: { lt: threeDaysAgo },
        project: {
          status: { in: ["DOC_COLLECTING", "IN_PROGRESS"] },
        },
      },
      include: {
        project: {
          include: {
            client: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    let processed = 0;

    for (const item of items) {
      const client = item.project.client;

      // Send reminder email if client has an email address
      if (client.email) {
        const html = docRequestEmail({
          clientName: client.name,
          projectName: item.project.title ?? "",
          items: [item.name],
          uploadUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/portal`,
        });

        await sendEmail({
          to: client.email,
          subject: `[서류 재요청] ${item.name} 제출을 부탁드립니다`,
          html,
        }).catch((err: unknown) => {
          console.error(`doc-reminder: email failed for item ${item.id}`, err);
        });
      }

      // Determine the consultant userId to notify (assignedTo on project or client)
      const consultantId = item.project.assignedTo ?? null;
      if (consultantId) {
        await create({
          userId: consultantId,
          type: "DOC_REQUESTED",
          title: `서류 미제출 리마인더: ${item.name}`,
          body: `${client.name}의 ${item.name} 서류가 3일 이상 미제출 상태입니다.`,
          link: `/projects/${item.projectId}`,
        }).catch((err: unknown) => {
          console.error(`doc-reminder: notification failed for item ${item.id}`, err);
        });
      }

      processed++;
    }

    return NextResponse.json({ success: true, processed });
  } catch (err) {
    return handleInternalError(err);
  }
}
