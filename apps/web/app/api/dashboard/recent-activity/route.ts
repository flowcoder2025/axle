import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import {
  handleInternalError,
  unauthorizedResponse,
} from "@/lib/api-helpers";

interface ActivityEvent {
  id: string;
  type: "document" | "meeting";
  title: string;
  date: string;
  subtitle: string;
}

// GET /api/dashboard/recent-activity
// Returns recent documents and meetings from the last 7 days, merged and sorted by date desc, max 8.
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse();
    }
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const now = new Date();
    const sevenDaysAgo = new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000
    );

    const [recentDocuments, recentMeetings] = await Promise.all([
      prisma.document.findMany({
        where: {
          client: { orgId: user.orgId },
          createdAt: { gte: sevenDaysAgo },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          createdAt: true,
          client: { select: { name: true } },
        },
      }),
      prisma.meeting.findMany({
        where: {
          client: { orgId: user.orgId },
          date: { gte: sevenDaysAgo, lte: now },
        },
        orderBy: { date: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          date: true,
          client: { select: { name: true } },
        },
      }),
    ]);

    const events: ActivityEvent[] = [
      ...recentDocuments.map((doc) => ({
        id: doc.id,
        type: "document" as const,
        title: doc.name,
        date: doc.createdAt.toISOString(),
        subtitle: doc.client.name,
      })),
      ...recentMeetings.map((mtg) => ({
        id: mtg.id,
        type: "meeting" as const,
        title: mtg.title,
        date: mtg.date.toISOString(),
        subtitle: mtg.client.name,
      })),
    ];

    events.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const data = events.slice(0, 8);

    return NextResponse.json({ data, total: data.length });
  } catch (err) {
    return handleInternalError(err);
  }
}
