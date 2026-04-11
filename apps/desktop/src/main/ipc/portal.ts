/**
 * IPC handlers for portal automation.
 * Routes portal:login, portal:scrape, portal:status, portal:logout
 * to the appropriate page-object based on the portal name.
 */

import { ipcMain } from "electron";
import { randomUUID } from "crypto";

import { HometaxPageObject } from "../portal/page-objects/hometax";
import { Minwon24PageObject } from "../portal/page-objects/minwon24";
import { InsurancePageObject } from "../portal/page-objects/insurance";
import { VentureinPageObject } from "../portal/page-objects/venturein";
import { KoitaPageObject } from "../portal/page-objects/koita";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PortalName = "hometax" | "minwon24" | "insurance" | "venturein" | "koita";

export interface PortalSession {
  sessionId: string;
  portal: PortalName;
  loggedInAt: string;
}

export interface PortalScrapeResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

// ---------------------------------------------------------------------------
// Session store
// ---------------------------------------------------------------------------

interface ActiveSession {
  meta: PortalSession;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pageObject: any;
}

const sessions = new Map<string, ActiveSession>();

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function createPageObject(portal: PortalName) {
  switch (portal) {
    case "hometax":
      return new HometaxPageObject();
    case "minwon24":
      return new Minwon24PageObject();
    case "insurance":
      return new InsurancePageObject();
    case "venturein":
      return new VentureinPageObject();
    case "koita":
      return new KoitaPageObject();
    default: {
      const _exhaustive: never = portal;
      throw new Error(`Unknown portal: ${_exhaustive}`);
    }
  }
}

// ---------------------------------------------------------------------------
// IPC handler registration
// ---------------------------------------------------------------------------

export function registerPortalHandlers(): void {
  ipcMain.handle(
    "portal:login",
    async (
      _event,
      portal: PortalName,
      credentials: Record<string, string>
    ): Promise<PortalSession> => {
      const pageObject = createPageObject(portal);
      await pageObject.login(credentials);

      const sessionId = randomUUID();
      const meta: PortalSession = {
        sessionId,
        portal,
        loggedInAt: new Date().toISOString(),
      };

      sessions.set(sessionId, { meta, pageObject });
      return meta;
    }
  );

  ipcMain.handle(
    "portal:scrape",
    async (
      _event,
      sessionId: string,
      action: string,
      params?: Record<string, unknown>
    ): Promise<PortalScrapeResult> => {
      const session = sessions.get(sessionId);
      if (!session) {
        return { success: false, error: "Session not found or expired" };
      }

      try {
        const { pageObject } = session;
        let data: unknown;

        // Route action to appropriate method
        if (typeof pageObject[action] === "function") {
          data = await pageObject[action](params);
        } else {
          throw new Error(`Action "${action}" not supported for portal "${session.meta.portal}"`);
        }

        return {
          success: true,
          data: data as Record<string, unknown>,
        };
      } catch (err) {
        return {
          success: false,
          error: (err as Error).message,
        };
      }
    }
  );

  ipcMain.handle(
    "portal:status",
    async (_event, sessionId: string): Promise<PortalSession | null> => {
      return sessions.get(sessionId)?.meta ?? null;
    }
  );

  ipcMain.handle(
    "portal:logout",
    async (_event, sessionId: string): Promise<void> => {
      const session = sessions.get(sessionId);
      if (session) {
        try {
          await session.pageObject.logout();
        } catch {
          // ignore logout errors
        }
        sessions.delete(sessionId);
      }
    }
  );
}

// Expose for testing
export { sessions, createPageObject };
