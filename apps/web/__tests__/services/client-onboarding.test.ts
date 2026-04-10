import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_ONBOARDING_ITEMS,
  sendOnboardingChecklist,
  type OnboardingChecklistPayload,
} from "../../lib/services/client-onboarding";

describe("DEFAULT_ONBOARDING_ITEMS", () => {
  it("contains exactly 5 items", () => {
    expect(DEFAULT_ONBOARDING_ITEMS).toHaveLength(5);
  });

  it("marks NDA, 사업자등록증 사본, 대표자 신분증 사본, 재무제표 as required", () => {
    const required = DEFAULT_ONBOARDING_ITEMS.filter((i) => i.isRequired).map(
      (i) => i.name
    );
    expect(required).toContain("NDA (비밀유지계약)");
    expect(required).toContain("사업자등록증 사본");
    expect(required).toContain("대표자 신분증 사본");
    expect(required).toContain("최근 3년 재무제표");
  });

  it("marks 기업 소개서 as optional", () => {
    const item = DEFAULT_ONBOARDING_ITEMS.find((i) => i.name === "기업 소개서");
    expect(item).toBeDefined();
    expect(item?.isRequired).toBe(false);
  });
});

describe("sendOnboardingChecklist", () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs the checklist payload with clientId and orgId", async () => {
    await sendOnboardingChecklist("client-1", "org-1");

    expect(consoleInfoSpy).toHaveBeenCalledOnce();
    const [label, payload] = consoleInfoSpy.mock.calls[0] as [string, OnboardingChecklistPayload];
    expect(label).toBe("[onboarding] checklist prepared");
    expect(payload.clientId).toBe("client-1");
    expect(payload.orgId).toBe("org-1");
    expect(payload.items).toBe(DEFAULT_ONBOARDING_ITEMS);
    expect(typeof payload.initiatedAt).toBe("string");
  });

  it("sets initiatedAt to a valid ISO date string", async () => {
    const before = new Date().toISOString();
    await sendOnboardingChecklist("client-2", "org-2");
    const after = new Date().toISOString();

    const payload = consoleInfoSpy.mock.calls[0][1] as OnboardingChecklistPayload;
    expect(payload.initiatedAt >= before).toBe(true);
    expect(payload.initiatedAt <= after).toBe(true);
  });

  it("does not throw when an internal error occurs", async () => {
    // Simulate console.info throwing to exercise the catch branch
    consoleInfoSpy.mockImplementation(() => {
      throw new Error("unexpected");
    });

    await expect(
      sendOnboardingChecklist("client-3", "org-3")
    ).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    const [label] = consoleErrorSpy.mock.calls[0] as [string];
    expect(label).toBe("[onboarding] failed to prepare checklist");
  });

  it("never throws even on repeated calls", async () => {
    await expect(
      Promise.all([
        sendOnboardingChecklist("c-a", "o-1"),
        sendOnboardingChecklist("c-b", "o-1"),
      ])
    ).resolves.toBeDefined();
  });
});
