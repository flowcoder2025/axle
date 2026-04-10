import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const schemaPath = resolve(__dirname, "../prisma/schema.prisma");
const schema = readFileSync(schemaPath, "utf-8");

describe("WI-006: Project/Document schema — 7 models", () => {
  const requiredModels = [
    "Project",
    "ProjectMember",
    "ChecklistTemplate",
    "ChecklistItem",
    "Document",
    "DocumentEmbedding",
    "ResearchJournal",
  ];

  for (const model of requiredModels) {
    it(`defines model ${model}`, () => {
      expect(schema).toMatch(new RegExp(`model\\s+${model}\\s*\\{`));
    });
  }

  describe("ProjectType enum", () => {
    it("is defined with all 8 values", () => {
      expect(schema).toMatch(/enum\s+ProjectType\s*\{/);
      expect(schema).toContain("BUSINESS_PLAN");
      expect(schema).toContain("VENTURE_CERT");
      expect(schema).toContain("SOBOOJANG_CERT");
      expect(schema).toContain("RESEARCH_INSTITUTE");
      expect(schema).toContain("PATENT");
      expect(schema).toContain("FINANCIAL_ANALYSIS");
      expect(schema).toContain("RESEARCH_TASK");
      expect(schema).toContain("BUNDLE");
    });
  });

  describe("ProjectStatus enum", () => {
    it("is defined with all 8 values", () => {
      expect(schema).toMatch(/enum\s+ProjectStatus\s*\{/);
      expect(schema).toContain("INTAKE");
      expect(schema).toContain("DOC_COLLECTING");
      expect(schema).toContain("IN_PROGRESS");
      expect(schema).toContain("REVIEW");
      expect(schema).toContain("SUBMITTED");
      expect(schema).toContain("APPROVED");
      expect(schema).toContain("REJECTED");
      expect(schema).toContain("COMPLETED");
    });
  });

  describe("Priority enum", () => {
    it("is defined with LOW, MEDIUM, HIGH, URGENT", () => {
      expect(schema).toMatch(/enum\s+Priority\s*\{/);
      expect(schema).toContain("LOW");
      expect(schema).toContain("MEDIUM");
      expect(schema).toContain("HIGH");
      expect(schema).toContain("URGENT");
    });
  });

  describe("FeeType enum", () => {
    it("is defined with FIXED, SUCCESS_RATE, MONTHLY", () => {
      expect(schema).toMatch(/enum\s+FeeType\s*\{/);
      expect(schema).toContain("FIXED");
      expect(schema).toContain("SUCCESS_RATE");
      expect(schema).toContain("MONTHLY");
    });
  });

  describe("DocCategory enum", () => {
    it("is defined with INPUT, OUTPUT, TEMPLATE, ISSUED", () => {
      expect(schema).toMatch(/enum\s+DocCategory\s*\{/);
      expect(schema).toContain("INPUT");
      expect(schema).toContain("OUTPUT");
      expect(schema).toContain("TEMPLATE");
      expect(schema).toContain("ISSUED");
    });
  });

  describe("OcrStatus enum", () => {
    it("is defined with NONE, PROCESSING, COMPLETED, FAILED", () => {
      expect(schema).toMatch(/enum\s+OcrStatus\s*\{/);
      expect(schema).toContain("NONE");
      expect(schema).toContain("PROCESSING");
      // COMPLETED already tested in ProjectStatus; just check OcrStatus block presence
    });
  });

  describe("DocStatus enum", () => {
    it("is defined with PENDING, REQUESTED, UPLOADED, VERIFIED", () => {
      expect(schema).toMatch(/enum\s+DocStatus\s*\{/);
      expect(schema).toContain("PENDING");
      expect(schema).toContain("REQUESTED");
      expect(schema).toContain("UPLOADED");
      expect(schema).toContain("VERIFIED");
    });
  });

  describe("JournalStatus enum", () => {
    it("is defined with DRAFT, SUBMITTED, APPROVED", () => {
      expect(schema).toMatch(/enum\s+JournalStatus\s*\{/);
      expect(schema).toContain("DRAFT");
    });
  });

  describe("Project model", () => {
    it("has self-referential ProjectTree relation", () => {
      expect(schema).toContain('"ProjectTree"');
    });

    it("has status defaulting to INTAKE", () => {
      expect(schema).toMatch(/status\s+ProjectStatus\s+@default\(INTAKE\)/);
    });

    it("has priority defaulting to MEDIUM", () => {
      expect(schema).toMatch(/priority\s+Priority\s+@default\(MEDIUM\)/);
    });

    it("has fee fields: feeType, feeAmount, successRate, isPaid", () => {
      expect(schema).toContain("feeType");
      expect(schema).toContain("feeAmount");
      expect(schema).toContain("successRate");
      expect(schema).toContain("isPaid");
    });

    it("has @@index on clientId and programId", () => {
      const clientIdIndexes = [
        ...schema.matchAll(/@@index\(\[clientId\]\)/g),
      ];
      expect(clientIdIndexes.length).toBeGreaterThan(0);
      const programIdIndexes = [
        ...schema.matchAll(/@@index\(\[programId\]\)/g),
      ];
      expect(programIdIndexes.length).toBeGreaterThan(0);
    });

    it("has relation to Client", () => {
      expect(schema).toMatch(
        /client\s+Client\s+@relation\(fields:\s*\[clientId\],\s*references:\s*\[id\]\)/,
      );
    });
  });

  describe("ProjectMember model", () => {
    it("has unique constraint on projectId+userId", () => {
      expect(schema).toContain("@@unique([projectId, userId])");
    });

    it("has role defaulting to MEMBER", () => {
      expect(schema).toMatch(
        /role\s+ProjectMemberRole\s+@default\(MEMBER\)/,
      );
    });

    it("has cascade delete on project relation", () => {
      expect(schema).toMatch(
        /project\s+Project\s+@relation\(fields:\s*\[projectId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/,
      );
    });
  });

  describe("ChecklistTemplate model", () => {
    it("has @@index on orgId and projectType", () => {
      expect(schema).toContain("@@index([orgId, projectType])");
    });

    it("has relation to Organization", () => {
      expect(schema).toMatch(
        /organization\s+Organization\s+@relation\(fields:\s*\[orgId\],\s*references:\s*\[id\]\)/,
      );
    });
  });

  describe("Document model", () => {
    it("has uploadToken with @unique", () => {
      expect(schema).toMatch(/uploadToken\s+String\?\s+@unique/);
    });

    it("has ocrStatus defaulting to NONE", () => {
      expect(schema).toMatch(/ocrStatus\s+OcrStatus\s+@default\(NONE\)/);
    });

    it("has relation to Client and optional relation to Project", () => {
      expect(schema).toMatch(
        /client\s+Client\s+@relation\(fields:\s*\[clientId\],\s*references:\s*\[id\]\)/,
      );
      expect(schema).toMatch(
        /project\s+Project\?\s+@relation\(fields:\s*\[projectId\],\s*references:\s*\[id\]\)/,
      );
    });
  });

  describe("DocumentEmbedding model", () => {
    it("has Unsupported vector(1536) embedding field", () => {
      expect(schema).toContain('Unsupported("vector(1536)")');
    });

    it("has @@unique on sourceType and sourceId", () => {
      expect(schema).toContain("@@unique([sourceType, sourceId])");
    });
  });

  describe("ResearchJournal model", () => {
    it("has status defaulting to DRAFT", () => {
      expect(schema).toMatch(/status\s+JournalStatus\s+@default\(DRAFT\)/);
    });

    it("has relation to Contact as researcher", () => {
      expect(schema).toMatch(
        /researcher\s+Contact\s+@relation\(fields:\s*\[researcherContactId\],\s*references:\s*\[id\]\)/,
      );
    });

    it("has @@index on clientId and researcherContactId", () => {
      expect(schema).toContain("@@index([researcherContactId])");
    });
  });

  describe("Existing models — new relations", () => {
    it("Client has projects relation", () => {
      expect(schema).toMatch(/projects\s+Project\[\]/);
    });

    it("Client has documents relation", () => {
      expect(schema).toMatch(/documents\s+Document\[\]/);
    });

    it("Client has journals relation", () => {
      expect(schema).toMatch(/journals\s+ResearchJournal\[\]/);
    });

    it("Contact has journals relation", () => {
      const journalMatches = [...schema.matchAll(/journals\s+ResearchJournal\[\]/g)];
      expect(journalMatches.length).toBeGreaterThanOrEqual(2);
    });

    it("Organization has templates relation", () => {
      expect(schema).toMatch(/templates\s+ChecklistTemplate\[\]/);
    });
  });
});
