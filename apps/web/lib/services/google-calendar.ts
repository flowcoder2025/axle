import { google } from "googleapis";
import { prisma } from "@axle/db";

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface GoogleCalendarEvent {
  id?: string | null;
  summary?: string | null;
  description?: string | null;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
}

/** Build an OAuth2 client, optionally seeded with stored tokens. */
function getOAuthClient(tokens?: OAuthTokens) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  if (tokens) {
    client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });
  }

  return client;
}

/** Return the Google OAuth consent URL. */
export function getAuthUrl(): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ],
  });
}

/** Exchange an authorization code for access + refresh tokens. */
export async function exchangeCode(
  code: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("Missing tokens in OAuth response");
  }
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  };
}

/** Push an AXLE schedule to Google Calendar. Returns the Google event ID. */
export async function pushToGoogle(
  schedule: {
    id: string;
    title: string;
    description?: string | null;
    startDate: Date;
    endDate?: Date | null;
    isAllDay: boolean;
    googleCalendarId?: string | null;
  },
  tokens: OAuthTokens
): Promise<string> {
  const auth = getOAuthClient(tokens);
  const calendar = google.calendar({ version: "v3", auth });

  const startIso = schedule.startDate.toISOString();
  const endIso = schedule.endDate
    ? schedule.endDate.toISOString()
    : schedule.startDate.toISOString();

  const event: GoogleCalendarEvent = schedule.isAllDay
    ? {
        summary: schedule.title,
        description: schedule.description ?? undefined,
        start: { date: schedule.startDate.toISOString().slice(0, 10) },
        end: {
          date: (schedule.endDate ?? schedule.startDate).toISOString().slice(0, 10),
        },
      }
    : {
        summary: schedule.title,
        description: schedule.description ?? undefined,
        start: { dateTime: startIso, timeZone: "UTC" },
        end: { dateTime: endIso, timeZone: "UTC" },
      };

  if (schedule.googleCalendarId) {
    // Update existing event
    const res = await calendar.events.update({
      calendarId: "primary",
      eventId: schedule.googleCalendarId,
      requestBody: event,
    });
    return res.data.id!;
  } else {
    // Create new event
    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
    });
    const googleId = res.data.id!;

    // Store the google calendar event id on the AXLE schedule
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: { googleCalendarId: googleId },
    });

    return googleId;
  }
}

/** Pull events from Google Calendar and upsert them as AXLE schedules. */
export async function pullFromGoogle(
  calendarId: string,
  tokens: OAuthTokens,
  orgId: string
): Promise<{ created: number; updated: number }> {
  const auth = getOAuthClient(tokens);
  const calendar = google.calendar({ version: "v3", auth });

  // Fetch events updated in the last 30 days
  const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const res = await calendar.events.list({
    calendarId,
    timeMin,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
  });

  const events = res.data.items ?? [];

  // Collect valid Google event IDs to batch-lookup existing schedules
  const validEvents = events.filter(
    (e): e is typeof e & { id: string; summary: string } =>
      !!e.id && !!e.summary
  );

  if (validEvents.length === 0) {
    return { created: 0, updated: 0 };
  }

  // Batch lookup: fetch all existing schedules linked to these Google events
  const googleIds = validEvents.map((e) => e.id);
  const existingSchedules = await prisma.schedule.findMany({
    where: { orgId, googleCalendarId: { in: googleIds } },
    select: { id: true, googleCalendarId: true },
  });
  const existingMap = new Map(
    existingSchedules.map((s) => [s.googleCalendarId!, s.id])
  );

  let created = 0;
  let updated = 0;

  for (const event of validEvents) {
    const startDate = event.start?.dateTime
      ? new Date(event.start.dateTime)
      : event.start?.date
      ? new Date(event.start.date)
      : null;

    const endDate = event.end?.dateTime
      ? new Date(event.end.dateTime)
      : event.end?.date
      ? new Date(event.end.date)
      : null;

    if (!startDate) continue;

    const isAllDay = !event.start?.dateTime;
    const existingId = existingMap.get(event.id);

    if (existingId) {
      await prisma.schedule.update({
        where: { id: existingId },
        data: {
          title: event.summary,
          description: event.description ?? null,
          startDate,
          endDate: endDate ?? null,
          isAllDay,
        },
      });
      updated++;
    } else {
      await prisma.schedule.create({
        data: {
          orgId,
          title: event.summary,
          description: event.description ?? null,
          type: "MEETING",
          startDate,
          endDate: endDate ?? null,
          isAllDay,
          googleCalendarId: event.id,
          reminderDays: [],
        },
      });
      created++;
    }
  }

  return { created, updated };
}

/** Bidirectional sync: push unsynced local AXLE schedules, then pull Google events. */
export async function syncCalendar(
  orgId: string,
  tokens: OAuthTokens
): Promise<{ pushed: number; pulled: number }> {
  // Push: only schedules without a googleCalendarId (not yet synced to Google)
  const unsyncedSchedules = await prisma.schedule.findMany({
    where: { orgId, googleCalendarId: null },
    orderBy: { createdAt: "desc" },
    take: 250,
  });

  let pushed = 0;
  for (const schedule of unsyncedSchedules) {
    try {
      await pushToGoogle(schedule, tokens);
      pushed++;
    } catch {
      // Log and continue — non-fatal
      console.error(`[google-calendar] push failed for schedule ${schedule.id}`);
    }
  }

  // Pull: fetch from Google's primary calendar and track created/updated counts
  const result = await pullFromGoogle("primary", tokens, orgId);

  return { pushed, pulled: result.created + result.updated };
}
