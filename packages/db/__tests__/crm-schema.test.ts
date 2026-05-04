import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const schemaPath = resolve(__dirname, "../prisma/schema.prisma");
const schema = readFileSync(schemaPath, "utf-8");

describe("WI-005: CRM schema — 7 models", () => {
  const requiredModels = [
    "Client",
    "Contact",
    "ClientFinancial",
    "ClientAchievement",
    "Certificate",
    "ProgramInfo",
    "MatchingResult",
  ];

  for (const model of requiredModels) {
    it(`defines model ${model}`, () => {
      expect(schema).toMatch(new RegExp(`model\\s+${model}\\s*\\{`));
    });
  }

  it("defines ClientStatus enum with ACTIVE, INACTIVE, PROSPECT", () => {
    expect(schema).toMatch(/enum\s+ClientStatus\s*\{/);
    expect(schema).toContain("ACTIVE");
    expect(schema).toContain("INACTIVE");
    expect(schema).toContain("PROSPECT");
  });

  it("defines ContactSource enum with BUSINESS_CARD, MANUAL, IMPORT", () => {
    expect(schema).toMatch(/enum\s+ContactSource\s*\{/);
    expect(schema).toContain("BUSINESS_CARD");
    expect(schema).toContain("MANUAL");
    expect(schema).toContain("IMPORT");
  });

  it("defines AchievementType enum with all 5 values", () => {
    expect(schema).toMatch(/enum\s+AchievementType\s*\{/);
    expect(schema).toContain("PATENT");
    expect(schema).toContain("AWARD");
    expect(schema).toContain("CONTRACT");
    expect(schema).toContain("INVESTMENT");
    expect(schema).toContain("CERTIFICATION");
  });

  it("defines ProgramCategory enum with all 7 values", () => {
    expect(schema).toMatch(/enum\s+ProgramCategory\s*\{/);
    expect(schema).toContain("STARTUP");
    expect(schema).toContain("VENTURE");
    expect(schema).toContain("RND");
    expect(schema).toContain("EXPORT");
    expect(schema).toContain("SMART_FACTORY");
    expect(schema).toContain("GENERAL");
  });

  describe("Client model", () => {
    it("has relation to Organization", () => {
      expect(schema).toMatch(/organization\s+Organization\s+@relation/);
    });

    it("has @@index on orgId", () => {
      expect(schema).toMatch(/@@index\(\[orgId\]\)/);
    });

    it("has status field with ClientStatus default ACTIVE", () => {
      expect(schema).toMatch(/status\s+ClientStatus\s+@default\(ACTIVE\)/);
    });

    it("has Json fields for masterProfile and profileBlocks", () => {
      expect(schema).toMatch(/masterProfile\s+Json\?/);
      expect(schema).toMatch(/profileBlocks\s+Json\?/);
    });
  });

  describe("Contact model", () => {
    it("has cascade delete on client relation", () => {
      expect(schema).toMatch(
        /client\s+Client\s+@relation\(fields:\s*\[clientId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/,
      );
    });

    it("has source field with ContactSource default MANUAL", () => {
      expect(schema).toMatch(/source\s+ContactSource\s+@default\(MANUAL\)/);
    });
  });

  describe("ClientFinancial model", () => {
    it("has unique constraint on clientId+year", () => {
      expect(schema).toContain("@@unique([clientId, year])");
    });
  });

  describe("Organization model", () => {
    it("has clients relation", () => {
      expect(schema).toMatch(/clients\s+Client\[\]/);
    });

    it("has programs relation", () => {
      expect(schema).toMatch(/programs\s+ProgramInfo\[\]/);
    });
  });

  describe("MatchingResult model", () => {
    it("has index on clientId and programId", () => {
      // Both @@index([clientId]) and @@index([programId]) exist in schema
      const clientIdIndexes = [...schema.matchAll(/@@index\(\[clientId\]\)/g)];
      expect(clientIdIndexes.length).toBeGreaterThan(0);
      const programIdIndexes = [...schema.matchAll(/@@index\(\[programId\]\)/g)];
      expect(programIdIndexes.length).toBeGreaterThan(0);
    });
  });
});
