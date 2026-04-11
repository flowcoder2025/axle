import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { syncCalendar } from "@/lib/services/google-calendar";
import { verifyCronAuth } from "@/lib/cron-auth";
import { handleInternalError } from "@/lib/api-helpers";

// POST /api/cron/schedule-sync
// Scheduled: */15 * * * * (every 15 minutes)
// Trigger Google Calendar sync for all orgs that have connected Google accounts.
// Looks up the google OAuth Account for each org member and triggers sync.
export async function POST(request: Request): Promise<Response> {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find all Google OAuth accounts that have a refresh token (connected calendars)
    const googleAccounts = await prisma.account.findMany({
      where: {
        provider: "google",
        refresh_token: { not: null },
        access_token: { not: null },
      },
      include: {
        user: {
          include: {
            memberships: {
              select: { organizationId: true },
              take: 1,
            },
          },
        },
      },
    });

    let processed = 0;
    const seenOrgs = new Set<string>();

    for (const account of googleAccounts) {
      const orgId = account.user.memberships[0]?.organizationId;
      if (!orgId || seenOrgs.has(orgId)) continue;
      seenOrgs.add(orgId);

      if (!account.access_token || !account.refresh_token) continue;

      await syncCalendar(orgId, {
        accessToken: account.access_token,
        refreshToken: account.refresh_token,
      }).catch((err: unknown) => {
        console.error(`schedule-sync: sync failed for org ${orgId}`, err);
      });

      processed++;
    }

    return NextResponse.json({ success: true, processed });
  } catch (err) {
    return handleInternalError(err);
  }
}
