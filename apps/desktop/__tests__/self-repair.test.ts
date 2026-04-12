import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("repairSelector", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when no screenshot provided", async () => {
    const { repairSelector } = await import(
      "../src/main/portal/self-repair.js"
    );
    const result = await repairSelector({
      brokenSelector: "td.subject a",
      portal: "hometax",
      action: "login",
    });
    expect(result.newSelector).toBeNull();
    expect(result.explanation).toContain("No screenshot");
  });

  it("calls Agent Bridge and returns parsed selector", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          result: JSON.stringify({
            selector: '[data-testid="login-btn"]',
            confidence: 0.85,
            explanation: "Button has a stable data-testid attribute",
          }),
        }),
    });

    const { repairSelector } = await import(
      "../src/main/portal/self-repair.js"
    );
    const result = await repairSelector({
      brokenSelector: "button.login",
      portal: "hometax",
      action: "login",
      screenshotBase64: "iVBORw0KGgo=",
      pageUrl: "https://hometax.go.kr",
    });

    expect(result.newSelector).toBe('[data-testid="login-btn"]');
    expect(result.confidence).toBe(0.85);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/ai/run"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("handles Agent Bridge error gracefully", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const { repairSelector } = await import(
      "../src/main/portal/self-repair.js"
    );
    const result = await repairSelector({
      brokenSelector: "td a",
      portal: "bizinfo",
      action: "scrape",
      screenshotBase64: "iVBORw0KGgo=",
    });

    expect(result.newSelector).toBeNull();
    expect(result.explanation).toContain("500");
  });

  it("handles network error gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const { repairSelector } = await import(
      "../src/main/portal/self-repair.js"
    );
    const result = await repairSelector({
      brokenSelector: "td a",
      portal: "bizinfo",
      action: "scrape",
      screenshotBase64: "iVBORw0KGgo=",
    });

    expect(result.newSelector).toBeNull();
    expect(result.explanation).toContain("ECONNREFUSED");
  });
});

describe("assessSelectorFragility", () => {
  it("scores fragile selectors higher", async () => {
    const { assessSelectorFragility } = await import(
      "../src/main/portal/self-repair.js"
    );
    expect(assessSelectorFragility("div:nth-child(3) > span.abc123def456")).toBeGreaterThan(0.3);
  });

  it("scores stable selectors lower", async () => {
    const { assessSelectorFragility } = await import(
      "../src/main/portal/self-repair.js"
    );
    expect(assessSelectorFragility('[data-testid="login"]')).toBeLessThan(0.1);
  });
});
