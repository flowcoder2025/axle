import { describe, it, expect } from "vitest";
import {
  getTriggerConfig,
  TRIGGER_MAP,
  type BusinessEvent,
  type Channel,
  type Priority,
} from "../src/trigger-map.js";

const ALL_EVENTS: BusinessEvent[] = [
  "DOC_REQUESTED",
  "DOC_UPLOADED",
  "DOC_EXPIRING",
  "DEADLINE_APPROACHING",
  "MEETING_SCHEDULED",
  "JOURNAL_DUE",
  "ACTION_ITEM_CREATED",
  "ACTION_ITEM_DUE",
  "PROJECT_ASSIGNED",
  "MATCHING_RESULT",
  "AI_JOB_COMPLETE",
  "AI_JOB_FAILED",
  "PORTAL_COMPLETE",
  "HANDOFF",
];

const VALID_CHANNELS: Channel[] = [
  "IN_APP",
  "EMAIL",
  "SMS",
  "KAKAO",
  "PUSH",
  "TELEGRAM",
  "DISCORD",
];

const VALID_PRIORITIES: Priority[] = ["low", "normal", "high", "urgent"];

describe("TRIGGER_MAP", () => {
  it("covers all 14 business events", () => {
    expect(Object.keys(TRIGGER_MAP)).toHaveLength(14);
    for (const event of ALL_EVENTS) {
      expect(TRIGGER_MAP).toHaveProperty(event);
    }
  });

  it("each entry has at least one channel", () => {
    for (const event of ALL_EVENTS) {
      const config = TRIGGER_MAP[event];
      expect(config.channels.length).toBeGreaterThan(0);
    }
  });

  it("each channel value is a known Channel type", () => {
    for (const event of ALL_EVENTS) {
      for (const channel of TRIGGER_MAP[event].channels) {
        expect(VALID_CHANNELS).toContain(channel);
      }
    }
  });

  it("each priority value is a known Priority type", () => {
    for (const event of ALL_EVENTS) {
      expect(VALID_PRIORITIES).toContain(TRIGGER_MAP[event].priority);
    }
  });
});

describe("getTriggerConfig()", () => {
  it("returns the correct config for DOC_UPLOADED", () => {
    const config = getTriggerConfig("DOC_UPLOADED");
    expect(config.channels).toContain("IN_APP");
    expect(config.channels).toContain("EMAIL");
    expect(config.recipientRole).toBe("assignee");
    expect(config.priority).toBe("normal");
  });

  it("returns the correct config for DOC_REQUESTED", () => {
    const config = getTriggerConfig("DOC_REQUESTED");
    expect(config.channels).toContain("EMAIL");
    expect(config.channels).toContain("SMS");
    expect(config.recipientRole).toBe("client_contact");
  });

  it("returns urgent priority for AI_JOB_FAILED", () => {
    const config = getTriggerConfig("AI_JOB_FAILED");
    expect(config.priority).toBe("urgent");
    expect(config.channels).toContain("IN_APP");
    expect(config.channels).toContain("TELEGRAM");
    expect(config.channels).toContain("DISCORD");
  });

  it("returns low priority for MATCHING_RESULT", () => {
    const config = getTriggerConfig("MATCHING_RESULT");
    expect(config.priority).toBe("low");
  });

  it("returns all_members recipientRole for MEETING_SCHEDULED", () => {
    const config = getTriggerConfig("MEETING_SCHEDULED");
    expect(config.recipientRole).toBe("all_members");
  });

  it("returns high priority for DEADLINE_APPROACHING", () => {
    const config = getTriggerConfig("DEADLINE_APPROACHING");
    expect(config.priority).toBe("high");
    expect(config.channels).toContain("TELEGRAM");
  });

  it("returns client_contact for JOURNAL_DUE", () => {
    const config = getTriggerConfig("JOURNAL_DUE");
    expect(config.recipientRole).toBe("client_contact");
    expect(config.channels).toContain("EMAIL");
    expect(config.channels).toContain("SMS");
  });

  it("returns DISCORD channel for AI_JOB_COMPLETE", () => {
    const config = getTriggerConfig("AI_JOB_COMPLETE");
    expect(config.channels).toContain("DISCORD");
  });

  it("returns identical object to TRIGGER_MAP entry", () => {
    for (const event of ALL_EVENTS) {
      expect(getTriggerConfig(event)).toBe(TRIGGER_MAP[event]);
    }
  });
});
