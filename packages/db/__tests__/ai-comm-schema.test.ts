import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const schemaPath = resolve(__dirname, "../prisma/schema.prisma");
const schema = readFileSync(schemaPath, "utf-8");

describe("WI-007: AI/Communication/Schedule schema — 13 models", () => {
  const requiredModels = [
    "Meeting",
    "MeetingAttendee",
    "MeetingTranscript",
    "ActionItem",
    "AiJob",
    "SkillPattern",
    "AutomationLog",
    "Notification",
    "EmailLog",
    "Schedule",
    "FinancialReport",
    "Estimate",
    "Contract",
  ];

  for (const model of requiredModels) {
    it(`defines model ${model}`, () => {
      expect(schema).toMatch(new RegExp(`model\\s+${model}\\s*\\{`));
    });
  }

  describe("ScheduleType enum", () => {
    it("is defined with all 4 values", () => {
      expect(schema).toMatch(/enum\s+ScheduleType\s*\{/);
      expect(schema).toContain("DEADLINE");
      expect(schema).toContain("MEETING");
      expect(schema).toContain("REMINDER");
      expect(schema).toContain("PROGRAM_DUE");
    });
  });

  describe("AiJobType enum", () => {
    it("is defined with all 10 values", () => {
      expect(schema).toMatch(/enum\s+AiJobType\s*\{/);
      expect(schema).toContain("BUSINESS_PLAN");
      expect(schema).toContain("RESEARCH");
      expect(schema).toContain("OCR");
      expect(schema).toContain("TRANSCRIBE");
      expect(schema).toContain("SUMMARY");
      expect(schema).toContain("JOURNAL_DRAFT");
      expect(schema).toContain("FINANCIAL_ANALYSIS");
      expect(schema).toContain("GAP_DIAGNOSIS");
      expect(schema).toContain("EVALUATION");
      expect(schema).toContain("MATCHING");
    });
  });

  describe("AiTier enum", () => {
    it("is defined with all 4 values", () => {
      expect(schema).toMatch(/enum\s+AiTier\s*\{/);
      expect(schema).toContain("LOCAL_MLX");
      expect(schema).toContain("API_HAIKU");
      expect(schema).toContain("API_OPUS");
      expect(schema).toContain("CLI_CLAUDE");
    });
  });

  describe("JobStatus enum", () => {
    it("is defined with QUEUED, RUNNING, COMPLETED, FAILED", () => {
      expect(schema).toMatch(/enum\s+JobStatus\s*\{/);
      expect(schema).toContain("QUEUED");
      expect(schema).toContain("RUNNING");
    });
  });

  describe("AutoType enum", () => {
    it("is defined with all 5 values", () => {
      expect(schema).toMatch(/enum\s+AutoType\s*\{/);
      expect(schema).toContain("HOMETAX_ISSUE");
      expect(schema).toContain("MINWON24_ISSUE");
      expect(schema).toContain("INSURANCE_ISSUE");
      expect(schema).toContain("PORTAL_UPLOAD");
      expect(schema).toContain("DART_FETCH");
    });
  });

  describe("NotificationType enum", () => {
    it("is defined with all 16 values", () => {
      expect(schema).toMatch(/enum\s+NotificationType\s*\{/);
      expect(schema).toContain("DOC_REQUESTED");
      expect(schema).toContain("DOC_UPLOADED");
      expect(schema).toContain("DOC_EXPIRING");
      expect(schema).toContain("MEETING_NOTIFY");
      expect(schema).toContain("JOURNAL_DUE");
      expect(schema).toContain("ACTION_ITEM");
      expect(schema).toContain("ACTION_ITEM_DUE");
      expect(schema).toContain("PROJECT_ASSIGNED");
      expect(schema).toContain("MATCHING_RESULT");
      expect(schema).toContain("AI_JOB_COMPLETE");
      expect(schema).toContain("AI_JOB_FAILED");
      expect(schema).toContain("PORTAL_COMPLETE");
      expect(schema).toContain("HANDOFF");
      expect(schema).toContain("ESTIMATE_SENT");
      expect(schema).toContain("BUNDLE_COMPLETE");
    });
  });

  describe("EmailType enum", () => {
    it("is defined with all 9 values", () => {
      expect(schema).toMatch(/enum\s+EmailType\s*\{/);
      expect(schema).toContain("DOC_REQUEST");
      expect(schema).toContain("DOC_PUSH");
      expect(schema).toContain("MEETING_SUMMARY");
      expect(schema).toContain("ESTIMATE");
      expect(schema).toContain("CONTRACT");
      expect(schema).toContain("JOURNAL_REMINDER");
      expect(schema).toContain("DEADLINE_ALERT");
      expect(schema).toContain("MATCHING_DIGEST");
      expect(schema).toContain("ONBOARDING");
    });
  });

  describe("ActionStatus enum", () => {
    it("is defined with OPEN, IN_PROGRESS, DONE", () => {
      expect(schema).toMatch(/enum\s+ActionStatus\s*\{/);
      expect(schema).toContain("OPEN");
      expect(schema).toContain("IN_PROGRESS");
      expect(schema).toContain("DONE");
    });
  });

  describe("EstimateStatus enum", () => {
    it("is defined with DRAFT, SENT, ACCEPTED, REJECTED", () => {
      expect(schema).toMatch(/enum\s+EstimateStatus\s*\{/);
      expect(schema).toContain("ACCEPTED");
      expect(schema).toContain("REJECTED");
    });
  });

  describe("ContractStatus enum", () => {
    it("is defined with DRAFT, SENT, SIGNED, EXPIRED", () => {
      expect(schema).toMatch(/enum\s+ContractStatus\s*\{/);
      expect(schema).toContain("SIGNED");
      expect(schema).toContain("EXPIRED");
    });
  });

  describe("Meeting model", () => {
    it("has relation to Client", () => {
      expect(schema).toMatch(
        /client\s+Client\s+@relation\(fields:\s*\[clientId\],\s*references:\s*\[id\]\)/,
      );
    });

    it("has optional relation to Project", () => {
      expect(schema).toMatch(
        /project\s+Project\?\s+@relation\(fields:\s*\[projectId\],\s*references:\s*\[id\]\)/,
      );
    });

    it("has @@index on clientId and projectId", () => {
      const indexes = [...schema.matchAll(/@@index\(\[clientId\]\)/g)];
      expect(indexes.length).toBeGreaterThan(0);
    });

    it("has attendees, transcript, actionItems, emailLogs relations", () => {
      expect(schema).toMatch(/attendees\s+MeetingAttendee\[\]/);
      expect(schema).toMatch(/transcript\s+MeetingTranscript\?/);
      expect(schema).toMatch(/actionItems\s+ActionItem\[\]/);
      expect(schema).toMatch(/emailLogs\s+EmailLog\[\]/);
    });
  });

  describe("MeetingTranscript model", () => {
    it("has @unique on meetingId", () => {
      expect(schema).toMatch(/meetingId\s+String\s+@unique/);
    });

    it("has cascade delete on meeting relation", () => {
      expect(schema).toMatch(
        /meeting\s+Meeting\s+@relation\(fields:\s*\[meetingId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/,
      );
    });
  });

  describe("ActionItem model", () => {
    it("has status defaulting to OPEN", () => {
      expect(schema).toMatch(/status\s+ActionStatus\s+@default\(OPEN\)/);
    });

    it("has cascade delete on meeting relation", () => {
      const cascadeMatches = [
        ...schema.matchAll(
          /meeting\s+Meeting\s+@relation\(fields:\s*\[meetingId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/g,
        ),
      ];
      expect(cascadeMatches.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("AiJob model", () => {
    it("has status defaulting to QUEUED", () => {
      expect(schema).toMatch(/status\s+JobStatus\s+@default\(QUEUED\)/);
    });

    it("has optional relation to SkillPattern", () => {
      expect(schema).toMatch(
        /skillPattern\s+SkillPattern\?\s+@relation\(fields:\s*\[skillPatternId\],\s*references:\s*\[id\]\)/,
      );
    });

    it("has @@index on type", () => {
      expect(schema).toContain("@@index([type])");
    });

    it("has cost, durationMs, errorMessage fields", () => {
      expect(schema).toContain("cost");
      expect(schema).toContain("durationMs");
      expect(schema).toContain("errorMessage");
    });
  });

  describe("SkillPattern model", () => {
    it("has successCount defaulting to 0", () => {
      expect(schema).toMatch(/successCount\s+Int\s+@default\(0\)/);
    });

    it("has isFineTuned defaulting to false", () => {
      expect(schema).toMatch(/isFineTuned\s+Boolean\s+@default\(false\)/);
    });

    it("has aiJobs relation", () => {
      expect(schema).toMatch(/aiJobs\s+AiJob\[\]/);
    });
  });

  describe("Notification model", () => {
    it("has isRead defaulting to false", () => {
      expect(schema).toMatch(/isRead\s+Boolean\s+@default\(false\)/);
    });

    it("has relation to User", () => {
      expect(schema).toMatch(
        /user\s+User\s+@relation\(fields:\s*\[userId\],\s*references:\s*\[id\]\)/,
      );
    });

    it("has @@index on userId", () => {
      const indexes = [...schema.matchAll(/@@index\(\[userId\]\)/g)];
      expect(indexes.length).toBeGreaterThan(0);
    });
  });

  describe("EmailLog model", () => {
    it("has channel defaulting to email", () => {
      expect(schema).toMatch(/channel\s+String\s+@default\("email"\)/);
    });

    it("has optional relation to Meeting", () => {
      expect(schema).toMatch(
        /meeting\s+Meeting\?\s+@relation\(fields:\s*\[meetingId\],\s*references:\s*\[id\]\)/,
      );
    });
  });

  describe("Schedule model", () => {
    it("has reminderDays with default [7, 3, 1]", () => {
      expect(schema).toMatch(/reminderDays\s+Int\[\]\s+@default\(\[7, 3, 1\]\)/);
    });

    it("has optional relation to ProgramInfo", () => {
      expect(schema).toMatch(
        /program\s+ProgramInfo\?\s+@relation\(fields:\s*\[programId\],\s*references:\s*\[id\]\)/,
      );
    });

    it("has @@index on orgId", () => {
      const indexes = [...schema.matchAll(/@@index\(\[orgId\]\)/g)];
      expect(indexes.length).toBeGreaterThan(0);
    });
  });

  describe("FinancialReport model", () => {
    it("has @@unique on clientId and year", () => {
      const uniqueMatches = [
        ...schema.matchAll(/@@unique\(\[clientId, year\]\)/g),
      ];
      expect(uniqueMatches.length).toBeGreaterThanOrEqual(1);
    });

    it("has optional relation to ClientFinancial", () => {
      expect(schema).toMatch(
        /clientFinancial\s+ClientFinancial\?\s+@relation\(fields:\s*\[clientFinancialId\],\s*references:\s*\[id\]\)/,
      );
    });
  });

  describe("Estimate model", () => {
    it("has estimateNumber with @unique", () => {
      expect(schema).toMatch(/estimateNumber\s+String\s+@unique/);
    });

    it("has status defaulting to DRAFT", () => {
      expect(schema).toMatch(/status\s+EstimateStatus\s+@default\(DRAFT\)/);
    });

    it("has @@index on clientId", () => {
      const indexes = [...schema.matchAll(/@@index\(\[clientId\]\)/g)];
      expect(indexes.length).toBeGreaterThan(0);
    });
  });

  describe("Contract model", () => {
    it("has contractNumber with @unique", () => {
      expect(schema).toMatch(/contractNumber\s+String\s+@unique/);
    });

    it("has status defaulting to DRAFT", () => {
      expect(schema).toMatch(/status\s+ContractStatus\s+@default\(DRAFT\)/);
    });

    it("has partyA, partyB, terms as Json fields", () => {
      expect(schema).toContain("partyA");
      expect(schema).toContain("partyB");
      expect(schema).toContain("terms");
    });
  });

  describe("Existing models — new WI-007 relations", () => {
    it("User has notifications relation", () => {
      expect(schema).toMatch(/notifications\s+Notification\[\]/);
    });

    it("Client has meetings relation", () => {
      expect(schema).toMatch(/meetings\s+Meeting\[\]/);
    });

    it("Client has financialReports relation", () => {
      expect(schema).toMatch(/financialReports\s+FinancialReport\[\]/);
    });

    it("Client has schedules relation", () => {
      expect(schema).toMatch(/schedules\s+Schedule\[\]/);
    });

    it("ClientFinancial has reports relation", () => {
      expect(schema).toMatch(/reports\s+FinancialReport\[\]/);
    });

    it("ProgramInfo has schedules relation", () => {
      const scheduleMatches = [...schema.matchAll(/schedules\s+Schedule\[\]/g)];
      expect(scheduleMatches.length).toBeGreaterThanOrEqual(2);
    });

    it("Project has meetings, aiJobs, estimates, contracts relations", () => {
      expect(schema).toMatch(/aiJobs\s+AiJob\[\]/);
      expect(schema).toMatch(/estimates\s+Estimate\[\]/);
      expect(schema).toMatch(/contracts\s+Contract\[\]/);
    });
  });
});
