import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { create } from "@axle/notification";
import { verifyCronAuth } from "@/lib/cron-auth";
import { handleInternalError } from "@/lib/api-helpers";

// POST /api/cron/doc-expiry
// Scheduled: 0 7 * * 1 (every Monday at 07:00 UTC)
// Find Documents where expiresAt between now and now+30days.
// Create DOC_EXPIRING notification for the assigned consultant.
export async function POST(request: Request): Promise<Response> {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const documents = await prisma.document.findMany({
      where: {
        expiresAt: { gte: now, lte: in30Days },
      },
      include: {
        client: {
          select: { id: true, name: true, assignedTo: true },
        },
      },
    });

    let processed = 0;

    for (const doc of documents) {
      const consultantId = doc.client.assignedTo;
      if (!consultantId) continue;

      const daysRemaining = Math.ceil(
        (doc.expiresAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      await create({
        userId: consultantId,
        type: "DOC_EXPIRING",
        title: `서류 만료 임박: ${doc.name} (D-${daysRemaining})`,
        body: `${doc.client.name}의 서류 "${doc.name}"이 ${daysRemaining}일 후 만료됩니다.`,
        link: `/clients/${doc.clientId}/documents/${doc.id}`,
      }).catch((err: unknown) => {
        console.error(`doc-expiry: notification failed for doc ${doc.id}`, err);
      });

      processed++;
    }

    return NextResponse.json({ success: true, processed });
  } catch (err) {
    return handleInternalError(err);
  }
}
