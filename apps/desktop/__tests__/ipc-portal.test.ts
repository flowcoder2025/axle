/**
 * Tests for portal IPC handlers (WI-128).
 * Mocks Electron's ipcMain.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

type IpcHandler = (event: unknown, ...args: unknown[]) => Promise<unknown>;
const handlers = new Map<string, IpcHandler>();

vi.mock("electron", () => ({
  ipcMain: {
    handle: (channel: string, fn: IpcHandler) => {
      handlers.set(channel, fn);
    },
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { registerPortalHandlers, sessions, createPageObject } from "../src/main/ipc/portal";
import type { PortalName } from "../src/main/ipc/portal";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const invoke = (channel: string, ...args: unknown[]) => {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`No handler for channel: ${channel}`);
  return handler(null, ...args);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Portal IPC handlers", () => {
  beforeEach(() => {
    handlers.clear();
    sessions.clear();
    registerPortalHandlers();
  });

  const portals: PortalName[] = ["hometax", "minwon24", "insurance", "venturein", "koita"];

  for (const portal of portals) {
    it(`login to ${portal} returns a session`, async () => {
      const session = await invoke("portal:login", portal, { userId: "u", password: "p" }) as {
        sessionId: string; portal: string; loggedInAt: string;
      };
      expect(session.sessionId).toBeTruthy();
      expect(session.portal).toBe(portal);
      expect(session.loggedInAt).toBeTruthy();
    });
  }

  it("portal:status returns session after login", async () => {
    const session = await invoke("portal:login", "hometax", { userId: "u", password: "p" }) as { sessionId: string };
    const status = await invoke("portal:status", session.sessionId);
    expect(status).not.toBeNull();
  });

  it("portal:status returns null for unknown sessionId", async () => {
    const status = await invoke("portal:status", "nonexistent");
    expect(status).toBeNull();
  });

  it("portal:logout removes session", async () => {
    const session = await invoke("portal:login", "minwon24", { userId: "u", password: "p" }) as { sessionId: string };
    await invoke("portal:logout", session.sessionId);
    expect(sessions.has(session.sessionId)).toBe(false);
  });

  it("portal:scrape with unknown sessionId returns error result", async () => {
    const result = await invoke("portal:scrape", "bad-session", "fetchDocumentList") as {
      success: boolean; error: string;
    };
    expect(result.success).toBe(false);
    expect(result.error).toContain("Session not found");
  });

  it("portal:scrape with unsupported action returns error result", async () => {
    const session = await invoke("portal:login", "hometax", { userId: "u", password: "p" }) as { sessionId: string };
    const result = await invoke("portal:scrape", session.sessionId, "nonExistentAction") as {
      success: boolean; error: string;
    };
    expect(result.success).toBe(false);
    expect(result.error).toContain("not supported");
  });
});

describe("createPageObject", () => {
  it("creates HometaxPageObject", () => {
    const obj = createPageObject("hometax");
    expect(typeof obj.login).toBe("function");
    expect(typeof obj.fetchTaxInfo).toBe("function");
  });

  it("creates Minwon24PageObject", () => {
    const obj = createPageObject("minwon24");
    expect(typeof obj.login).toBe("function");
    expect(typeof obj.fetchDocumentList).toBe("function");
  });

  it("creates InsurancePageObject", () => {
    const obj = createPageObject("insurance");
    expect(typeof obj.fetchContributions).toBe("function");
  });

  it("creates VentureinPageObject", () => {
    const obj = createPageObject("venturein");
    expect(typeof obj.fetchApplicationList).toBe("function");
  });

  it("creates KoitaPageObject", () => {
    const obj = createPageObject("koita");
    expect(typeof obj.fetchCertifications).toBe("function");
  });
});
