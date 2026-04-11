import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mock googleapis ---

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockList = vi.fn();
const mockGetToken = vi.fn();
const mockGenerateAuthUrl = vi.fn();
const mockSetCredentials = vi.fn();

vi.mock("googleapis", () => {
  const OAuth2 = vi.fn(() => ({
    getToken: mockGetToken,
    generateAuthUrl: mockGenerateAuthUrl,
    setCredentials: mockSetCredentials,
  }));

  return {
    google: {
      auth: { OAuth2 },
      calendar: vi.fn(() => ({
        events: {
          insert: mockInsert,
          update: mockUpdate,
          list: mockList,
        },
      })),
    },
  };
});

// --- Mock Prisma ---

const mockPrismaSchedule = {
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    schedule: mockPrismaSchedule,
  },
}));

const tokens = { accessToken: "acc-123", refreshToken: "ref-456" };

// --- Tests ---

describe("getAuthUrl", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns a URL string", async () => {
    mockGenerateAuthUrl.mockReturnValue("https://accounts.google.com/o/oauth2/auth?...");
    const { getAuthUrl } = await import("../../lib/services/google-calendar");
    const url = getAuthUrl();
    expect(typeof url).toBe("string");
    expect(url).toContain("accounts.google.com");
    expect(mockGenerateAuthUrl).toHaveBeenCalledWith(
      expect.objectContaining({ access_type: "offline", prompt: "consent" })
    );
  });
});

describe("exchangeCode", () => {
  beforeEach(() => vi.resetAllMocks());

  it("exchanges code for tokens", async () => {
    mockGetToken.mockResolvedValue({
      tokens: { access_token: "acc-123", refresh_token: "ref-456" },
    });

    const { exchangeCode } = await import("../../lib/services/google-calendar");
    const result = await exchangeCode("auth-code");
    expect(result.accessToken).toBe("acc-123");
    expect(result.refreshToken).toBe("ref-456");
  });

  it("throws when tokens are missing", async () => {
    mockGetToken.mockResolvedValue({
      tokens: { access_token: null, refresh_token: null },
    });

    const { exchangeCode } = await import("../../lib/services/google-calendar");
    await expect(exchangeCode("bad-code")).rejects.toThrow("Missing tokens");
  });
});

describe("pushToGoogle", () => {
  beforeEach(() => vi.resetAllMocks());

  it("creates a new Google event and stores the id", async () => {
    mockInsert.mockResolvedValue({ data: { id: "gcal-event-123" } });
    mockPrismaSchedule.update.mockResolvedValue({ id: "s-1", googleCalendarId: "gcal-event-123" });

    const { pushToGoogle } = await import("../../lib/services/google-calendar");
    const googleId = await pushToGoogle(
      {
        id: "s-1",
        title: "Q3 Deadline",
        description: null,
        startDate: new Date("2024-09-01T00:00:00.000Z"),
        endDate: null,
        isAllDay: false,
        googleCalendarId: null,
      },
      tokens
    );

    expect(googleId).toBe("gcal-event-123");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ calendarId: "primary" })
    );
    expect(mockPrismaSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s-1" },
        data: { googleCalendarId: "gcal-event-123" },
      })
    );
  });

  it("updates an existing Google event when googleCalendarId is set", async () => {
    mockUpdate.mockResolvedValue({ data: { id: "gcal-event-existing" } });

    const { pushToGoogle } = await import("../../lib/services/google-calendar");
    const googleId = await pushToGoogle(
      {
        id: "s-1",
        title: "Updated Title",
        description: "Updated desc",
        startDate: new Date("2024-09-01T00:00:00.000Z"),
        endDate: new Date("2024-09-01T01:00:00.000Z"),
        isAllDay: false,
        googleCalendarId: "gcal-event-existing",
      },
      tokens
    );

    expect(googleId).toBe("gcal-event-existing");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: "primary",
        eventId: "gcal-event-existing",
      })
    );
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("uses date-only format for all-day events", async () => {
    mockInsert.mockResolvedValue({ data: { id: "gcal-allday-123" } });
    mockPrismaSchedule.update.mockResolvedValue({});

    const { pushToGoogle } = await import("../../lib/services/google-calendar");
    await pushToGoogle(
      {
        id: "s-2",
        title: "All Day Event",
        description: null,
        startDate: new Date("2024-09-01T00:00:00.000Z"),
        endDate: null,
        isAllDay: true,
        googleCalendarId: null,
      },
      tokens
    );

    const call = mockInsert.mock.calls[0][0];
    expect(call.requestBody.start).toHaveProperty("date");
    expect(call.requestBody.start).not.toHaveProperty("dateTime");
  });
});

describe("pullFromGoogle", () => {
  beforeEach(() => vi.resetAllMocks());

  it("creates new AXLE schedules for unknown Google events", async () => {
    mockList.mockResolvedValue({
      data: {
        items: [
          {
            id: "gcal-new",
            summary: "Imported Meeting",
            description: "From Google",
            start: { dateTime: "2024-09-01T10:00:00Z" },
            end: { dateTime: "2024-09-01T11:00:00Z" },
          },
        ],
      },
    });
    mockPrismaSchedule.findMany.mockResolvedValue([]);
    mockPrismaSchedule.create.mockResolvedValue({ id: "s-new" });

    const { pullFromGoogle } = await import("../../lib/services/google-calendar");
    const result = await pullFromGoogle("primary", tokens, "org-1");

    expect(result).toEqual({ created: 1, updated: 0 });
    expect(mockPrismaSchedule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orgId: "org-1",
          googleCalendarId: "gcal-new",
          title: "Imported Meeting",
          type: "MEETING",
        }),
      })
    );
  });

  it("updates existing AXLE schedules for known Google events", async () => {
    mockList.mockResolvedValue({
      data: {
        items: [
          {
            id: "gcal-existing",
            summary: "Updated Meeting",
            description: null,
            start: { dateTime: "2024-09-02T10:00:00Z" },
            end: { dateTime: "2024-09-02T11:00:00Z" },
          },
        ],
      },
    });
    mockPrismaSchedule.findMany.mockResolvedValue([
      { id: "s-existing", googleCalendarId: "gcal-existing" },
    ]);
    mockPrismaSchedule.update.mockResolvedValue({ id: "s-existing" });

    const { pullFromGoogle } = await import("../../lib/services/google-calendar");
    const result = await pullFromGoogle("primary", tokens, "org-1");

    expect(result).toEqual({ created: 0, updated: 1 });
    expect(mockPrismaSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s-existing" },
        data: expect.objectContaining({ title: "Updated Meeting" }),
      })
    );
    expect(mockPrismaSchedule.create).not.toHaveBeenCalled();
  });

  it("skips events without id or summary", async () => {
    mockList.mockResolvedValue({
      data: {
        items: [
          { id: null, summary: "No ID" },
          { id: "gcal-1", summary: null },
        ],
      },
    });

    const { pullFromGoogle } = await import("../../lib/services/google-calendar");
    const result = await pullFromGoogle("primary", tokens, "org-1");

    expect(result).toEqual({ created: 0, updated: 0 });
    expect(mockPrismaSchedule.findMany).not.toHaveBeenCalled();
    expect(mockPrismaSchedule.create).not.toHaveBeenCalled();
  });
});

describe("syncCalendar", () => {
  beforeEach(() => vi.resetAllMocks());

  it("pushes only unsynced schedules and returns pulled counts", async () => {
    const unsyncedSchedules = [
      {
        id: "s-1",
        title: "Deadline",
        description: null,
        startDate: new Date("2024-09-01T00:00:00.000Z"),
        endDate: null,
        isAllDay: false,
        googleCalendarId: null,
        createdAt: new Date(),
      },
    ];

    // First findMany call: unsynced schedules for push
    // Second findMany call: batch lookup for pull (no existing)
    mockPrismaSchedule.findMany
      .mockResolvedValueOnce(unsyncedSchedules) // push: unsynced only
      .mockResolvedValueOnce([]); // pull: batch lookup

    mockInsert.mockResolvedValue({ data: { id: "gcal-new" } });
    mockPrismaSchedule.update.mockResolvedValue({});

    // Pull returns one new event
    mockList.mockResolvedValue({
      data: {
        items: [
          {
            id: "gcal-imported",
            summary: "Imported",
            start: { dateTime: "2024-09-05T10:00:00Z" },
            end: { dateTime: "2024-09-05T11:00:00Z" },
          },
        ],
      },
    });
    mockPrismaSchedule.create.mockResolvedValue({ id: "s-new" });

    const { syncCalendar } = await import("../../lib/services/google-calendar");
    const result = await syncCalendar("org-1", tokens);

    expect(result.pushed).toBe(1);
    expect(result.pulled).toBe(1); // 1 created + 0 updated
    // Verify only unsynced schedules were fetched for push
    expect(mockPrismaSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ googleCalendarId: null }),
      })
    );
  });
});
