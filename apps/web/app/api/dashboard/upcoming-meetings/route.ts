import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import {
  handleInternalError,
  unauthorizedResponse,
} from "@/lib/api-helpers";

// GET /api/dashboard/upcoming-meetings
// Returns meetings within the next 7 days, ordered by date asc, max 5.
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
    const sevenDaysFromNow = new Date(
      now.getTime() + 7 * 24 * 60 * 60 * 1000
    );

    const meetings = await prisma.meeting.findMany({
      where: {
        client: { orgId: user.orgId },
        date: { gte: now, lte: sevenDaysFromNow },
      },
      orderBy: { date: "asc" },
      take: 5,
      select: {
        id: true,
        title: true,
        date: true,
        location: true,
        client: { select: { name: true } },
      },
    });

    const data = meetings.map((m) => ({
      id: m.id,
      title: m.title,
      date: m.date.toISOString(),
      location: m.location,
      clientName: m.client.name,
    }));

    return NextResponse.json({ data, total: data.length });
  } catch (err) {
    return handleInternalError(err);
  }
}
