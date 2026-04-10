import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  repairSelector,
  tryWithRepair,
  getRepairLogs,
  clearRepairLogs,
} from "../src/self-repair.js";
import type { ElementHandleLike, PageLike } from "../src/types.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function makePage(elementMap: Record<string, ElementHandleLike | null> = {}): PageLike {
  return {
    goto: vi.fn().mockResolvedValue(null),
    waitForSelector: vi.fn().mockResolvedValue(null),
    $$: vi.fn().mockResolvedValue([]),
    $: vi.fn().mockImplementation((selector: string) =>
      Promise.resolve(elementMap[selector] ?? null)
    ),
    screenshot: vi.fn().mockResolvedValue("base64-data"),
    url: () => "https://www.bizinfo.go.kr/list",
    close: vi.fn().mockResolvedValue(undefined),
  };
}

function makeEl(): ElementHandleLike {
  return {
    textContent: async () => "text",
    getAttribute: async () => null,
    $$: async () => [],
    $: async () => null,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("repairSelector (Phase 8 — returns null, logs failure)", () => {
  beforeEach(() => clearRepairLogs());

  it("returns null", async () => {
    const page = makePage();
    const result = await repairSelector(page, ".missing-selector", "pagination next button");
    expect(result).toBeNull();
  });

  it("logs the failed selector", async () => {
    const page = makePage();
    await repairSelector(page, ".broken", "some element");
    const logs = getRepairLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].failedSelector).toBe(".broken");
    expect(logs[0].context).toBe("some element");
  });

  it("records the page URL in the log", async () => {
    const page = makePage();
    await repairSelector(page, ".x", "ctx");
    expect(getRepairLogs()[0].url).toBe("https://www.bizinfo.go.kr/list");
  });

  it("records occurredAt as a Date", async () => {
    const page = makePage();
    await repairSelector(page, ".x", "ctx");
    expect(getRepairLogs()[0].occurredAt).toBeInstanceOf(Date);
  });

  it("takes a screenshot (non-fatal if it throws)", async () => {
    const page = makePage();
    (page.screenshot as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("no viewport"));
    // Should not throw
    await expect(repairSelector(page, ".x", "ctx")).resolves.toBeNull();
  });
});

describe("tryWithRepair", () => {
  beforeEach(() => clearRepairLogs());

  it("returns true when original selector works", async () => {
    const el = makeEl();
    const page = makePage({ ".working": el });
    const action = vi.fn().mockResolvedValue(undefined);

    const result = await tryWithRepair(page, ".working", "ctx", action);

    expect(result).toBe(true);
    expect(action).toHaveBeenCalledWith(el);
  });

  it("returns false when original selector fails and repair returns null (Phase 8)", async () => {
    const page = makePage(); // no elements
    const action = vi.fn();

    const result = await tryWithRepair(page, ".broken", "ctx", action);

    expect(result).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  it("logs repair attempt when selector fails", async () => {
    const page = makePage();
    await tryWithRepair(page, ".gone", "some context", vi.fn());
    const logs = getRepairLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].failedSelector).toBe(".gone");
  });

  it("returns false when action throws even though element exists", async () => {
    const el = makeEl();
    const page = makePage({ ".el": el });
    const action = vi.fn().mockRejectedValue(new Error("click failed"));

    const result = await tryWithRepair(page, ".el", "ctx", action);

    // action failed, repair returns null in Phase 8 → false
    expect(result).toBe(false);
  });
});

describe("clearRepairLogs", () => {
  beforeEach(() => clearRepairLogs());

  it("empties the log", async () => {
    const page = makePage();
    await repairSelector(page, ".x", "ctx");
    expect(getRepairLogs()).toHaveLength(1);

    clearRepairLogs();
    expect(getRepairLogs()).toHaveLength(0);
  });
});
