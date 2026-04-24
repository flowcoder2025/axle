/**
 * Emit Coverage (WI-225)
 *
 * Verifies that every BusinessEvent declared in trigger-map.ts has at least
 * one corresponding `eventBus.emit("<EVENT_NAME>", ...)` call-site in the
 * web application. Pure static scan — fast, deterministic, and independent
 * of the runtime harness.
 *
 * When a new BusinessEvent is introduced, add the matching emit in the
 * responsible API route or cron handler. The failure message below names
 * the missing event to keep the feedback loop tight.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { TRIGGER_MAP, type BusinessEvent } from "../src/trigger-map.js";

// Walk the web app route tree and collect every .ts file.
function collectTsFiles(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      let st: ReturnType<typeof statSync>;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (entry === "node_modules" || entry === ".next" || entry === "dist") {
          continue;
        }
        walk(full);
      } else if (st.isFile() && full.endsWith(".ts") && !full.endsWith(".d.ts")) {
        out.push(full);
      }
    }
  }
  walk(root);
  return out;
}

const WEB_ROOTS = [
  resolve(__dirname, "../../../apps/web/app/api"),
  resolve(__dirname, "../../../apps/web/lib"),
];

/**
 * Dispatch-only events: BusinessEvents that do NOT flow through
 * `eventBus.emit()`. `setup.ts` derives them from other events (e.g.
 * BUNDLE_COMPLETED is minted from a PROJECT_COMPLETED with projectType ===
 * "BUNDLE") and calls `dispatch()` directly. Requiring a call-site for these
 * would force a duplicate emit that adds no information.
 */
const DISPATCH_ONLY_EVENTS: ReadonlySet<BusinessEvent> = new Set([
  "BUNDLE_COMPLETED",
]);

const ALL_EVENTS = (Object.keys(TRIGGER_MAP) as BusinessEvent[]).filter(
  (event) => !DISPATCH_ONLY_EVENTS.has(event),
);

// Scan once so every assertion reuses the same index.
const CALL_SITES: Record<BusinessEvent, string[]> = Object.fromEntries(
  ALL_EVENTS.map((event) => [event, [] as string[]]),
) as Record<BusinessEvent, string[]>;

const EMIT_PATTERN = /\.emit\(\s*["']([A-Z_]+)["']/g;

for (const root of WEB_ROOTS) {
  for (const file of collectTsFiles(root)) {
    // Skip files that merely import event-bus without emitting (e.g. setup.ts
    // registers handlers with .on, not .emit).
    if (file.endsWith("setup.ts") || file.endsWith("event-bus.ts")) continue;
    let content: string;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    let match: RegExpExecArray | null;
    while ((match = EMIT_PATTERN.exec(content)) !== null) {
      const evt = match[1] as BusinessEvent;
      if (evt in CALL_SITES) {
        CALL_SITES[evt].push(file);
      }
    }
    EMIT_PATTERN.lastIndex = 0;
  }
}

describe("emit coverage — every BusinessEvent is wired to at least one call-site", () => {
  for (const event of ALL_EVENTS) {
    it(`${event} has at least one eventBus.emit call-site`, () => {
      const sites = CALL_SITES[event];
      expect(
        sites.length,
        `No eventBus.emit("${event}", ...) found in apps/web/app or apps/web/lib. ` +
          `Add the emit in the responsible API route or cron handler.`,
      ).toBeGreaterThan(0);
    });
  }
});

describe("emit call-sites — expected routing", () => {
  it.each([
    ["DOC_UPLOADED", "documents/route.ts"],
    ["DOC_REQUESTED", "checklist/[itemId]/route.ts"],
    ["DOC_EXPIRING", "cron/doc-expiry/route.ts"],
    ["DEADLINE_APPROACHING", "cron/deadline-alert/route.ts"],
    ["MEETING_SCHEDULED", "meetings/route.ts"],
    ["JOURNAL_DUE", "cron/journal-remind/route.ts"],
    ["ACTION_ITEM_CREATED", "actions/route.ts"],
    ["ACTION_ITEM_DUE", "cron/deadline-alert/route.ts"],
    ["PROJECT_ASSIGNED", "projects/route.ts"],
    ["MATCHING_RESULT", "matching/route.ts"],
    ["AI_JOB_COMPLETE", "ai/jobs/[jobId]/route.ts"],
    ["AI_JOB_FAILED", "ai/jobs/[jobId]/route.ts"],
    ["PORTAL_COMPLETE", "upload/[token]/route.ts"],
    ["HANDOFF", "handoff/route.ts"],
  ] as const)("%s is emitted from %s", (event, expectedSuffix) => {
    const sites = CALL_SITES[event as BusinessEvent];
    expect(
      sites.some((s) => s.endsWith(expectedSuffix)),
      `Expected ${event} to be emitted from a file ending with "${expectedSuffix}". ` +
        `Found: ${sites.join(", ") || "(none)"}`,
    ).toBe(true);
  });
});
