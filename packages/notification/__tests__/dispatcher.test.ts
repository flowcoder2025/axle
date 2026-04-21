import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockCreate = vi.fn();
const mockPushFindMany = vi.fn();
vi.mock("@axle/db", () => ({
  prisma: {
    notification: { create: mockCreate },
    pushSubscription: { findMany: mockPushFindMany },
  },
}));

const mockSend = vi.fn();
vi.mock("@axle/email", () => ({
  send: mockSend,
}));

const mockSendPushNotification = vi.fn();
vi.mock("../src/web-push.js", () => ({
  sendPushNotification: mockSendPushNotification,
}));

const mockSendTelegramToDefault = vi.fn();
vi.mock("../src/telegram.js", () => ({
  sendTelegramToDefault: mockSendTelegramToDefault,
}));

const mockSendDiscordNotification = vi.fn();
vi.mock("../src/discord.js", () => ({
  sendDiscordNotification: mockSendDiscordNotification,
}));

// ── Tests ──────────────────────────────────────────────────────────────────

describe("dispatch()", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockCreate.mockResolvedValue({ id: "notif-1" });
    mockSend.mockResolvedValue(undefined);
    mockSendTelegramToDefault.mockResolvedValue(undefined);
    mockSendDiscordNotification.mockResolvedValue(undefined);
    mockPushFindMany.mockResolvedValue([]);
    mockSendPushNotification.mockResolvedValue(undefined);
  });

  it("creates IN_APP notifications for each recipientUserId", async () => {
    const { dispatch } = await import("../src/dispatcher.js");

    await dispatch({
      event: "DOC_UPLOADED",
      title: "서류 업로드 완료",
      body: "서류가 업로드되었습니다.",
      recipientUserIds: ["user-1", "user-2"],
      recipientEmails: ["a@example.com"],
    });

    // DOC_UPLOADED → IN_APP + EMAIL
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          type: "DOC_UPLOADED",
          title: "서류 업로드 완료",
        }),
      })
    );
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user-2" }),
      })
    );
  });

  it("sends emails for each recipientEmail on EMAIL channel", async () => {
    const { dispatch } = await import("../src/dispatcher.js");

    await dispatch({
      event: "DOC_UPLOADED",
      title: "서류 업로드 완료",
      recipientUserIds: [],
      recipientEmails: ["a@example.com", "b@example.com"],
    });

    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "email",
        options: expect.objectContaining({ to: "a@example.com" }),
      })
    );
  });

  it("sends SMS for each recipientPhone on SMS channel", async () => {
    const { dispatch } = await import("../src/dispatcher.js");

    await dispatch({
      event: "DOC_REQUESTED",
      title: "서류 제출 요청",
      recipientUserIds: [],
      recipientPhones: ["01012345678", "01087654321"],
    });

    expect(mockSend).toHaveBeenCalledTimes(2);
    const [firstCall] = mockSend.mock.calls;
    expect(firstCall[0].channel).toBe("sms");
    expect(firstCall[0].options.to).toBe("01012345678");
  });

  it("sends Telegram for DEADLINE_APPROACHING", async () => {
    const { dispatch } = await import("../src/dispatcher.js");

    await dispatch({
      event: "DEADLINE_APPROACHING",
      title: "마감일 임박",
      body: "내일까지입니다.",
      recipientUserIds: ["user-1"],
    });

    expect(mockSendTelegramToDefault).toHaveBeenCalledOnce();
    const [message] = mockSendTelegramToDefault.mock.calls[0] as [string];
    expect(message).toContain("마감일 임박");
  });

  it("sends Discord for AI_JOB_COMPLETE", async () => {
    const { dispatch } = await import("../src/dispatcher.js");

    await dispatch({
      event: "AI_JOB_COMPLETE",
      title: "AI 작업 완료",
      body: "분석 완료",
      recipientUserIds: ["user-1"],
    });

    expect(mockSendDiscordNotification).toHaveBeenCalledOnce();
    const [, options] = mockSendDiscordNotification.mock.calls[0] as [
      string,
      { embeds: Array<{ title: string }> },
    ];
    expect(options.embeds?.[0]?.title).toBe("AI 작업 완료");
  });

  it("sends Telegram + Discord for AI_JOB_FAILED (urgent)", async () => {
    const { dispatch } = await import("../src/dispatcher.js");

    await dispatch({
      event: "AI_JOB_FAILED",
      title: "AI 작업 실패",
      body: "타임아웃",
      recipientUserIds: ["user-1"],
    });

    expect(mockCreate).toHaveBeenCalledOnce(); // IN_APP
    expect(mockSendTelegramToDefault).toHaveBeenCalledOnce();
    expect(mockSendDiscordNotification).toHaveBeenCalledOnce();
  });

  it("isolates channel failures — other channels still run", async () => {
    mockSend.mockRejectedValue(new Error("SMTP error"));
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const { dispatch } = await import("../src/dispatcher.js");

    // DOC_UPLOADED: IN_APP + EMAIL. EMAIL will fail.
    await expect(
      dispatch({
        event: "DOC_UPLOADED",
        title: "서류 업로드",
        recipientUserIds: ["user-1"],
        recipientEmails: ["a@example.com"],
      })
    ).resolves.toBeUndefined(); // dispatch itself must not throw

    expect(mockCreate).toHaveBeenCalledOnce(); // IN_APP still ran
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("channel=EMAIL")
    );

    consoleSpy.mockRestore();
  });

  it("skips IN_APP when recipientUserIds is empty", async () => {
    const { dispatch } = await import("../src/dispatcher.js");

    await dispatch({
      event: "DOC_UPLOADED",
      title: "서류 업로드",
      recipientUserIds: [],
      recipientEmails: ["a@example.com"],
    });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("skips EMAIL when recipientEmails is empty", async () => {
    const { dispatch } = await import("../src/dispatcher.js");

    await dispatch({
      event: "DOC_UPLOADED",
      title: "서류 업로드",
      recipientUserIds: ["user-1"],
      recipientEmails: [],
    });

    expect(mockSend).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("passes link and body to IN_APP notification", async () => {
    const { dispatch } = await import("../src/dispatcher.js");

    await dispatch({
      event: "ACTION_ITEM_CREATED",
      title: "새 액션 아이템",
      body: "검토가 필요합니다.",
      link: "/projects/proj-1/action-items/ai-1",
      recipientUserIds: ["user-1"],
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: "검토가 필요합니다.",
          link: "/projects/proj-1/action-items/ai-1",
        }),
      })
    );
  });
});
