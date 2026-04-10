import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const schemaPath = resolve(__dirname, "../prisma/schema.prisma");
const schema = readFileSync(schemaPath, "utf-8");

describe("WI-004: Auth/Org schema — 6 models", () => {
  const requiredModels = [
    "User",
    "Account",
    "Session",
    "VerificationToken",
    "Organization",
    "Membership",
  ];

  for (const model of requiredModels) {
    it(`defines model ${model}`, () => {
      expect(schema).toMatch(new RegExp(`model\\s+${model}\\s*\\{`));
    });
  }

  it("defines MemberRole enum with OWNER, ADMIN, MEMBER", () => {
    expect(schema).toMatch(/enum\s+MemberRole\s*\{/);
    expect(schema).toContain("OWNER");
    expect(schema).toContain("ADMIN");
    expect(schema).toContain("MEMBER");
  });

  describe("User model (Auth.js v5 compatible)", () => {
    it("has email unique field", () => {
      expect(schema).toContain("email         String    @unique");
    });

    it("has emailVerified field", () => {
      expect(schema).toContain("emailVerified DateTime?");
    });

    it("has relations to accounts, sessions, memberships", () => {
      expect(schema).toMatch(/accounts\s+Account\[\]/);
      expect(schema).toMatch(/sessions\s+Session\[\]/);
      expect(schema).toMatch(/memberships\s+Membership\[\]/);
    });
  });

  describe("Account model (Auth.js v5 compatible)", () => {
    it("has unique constraint on provider+providerAccountId", () => {
      expect(schema).toContain("@@unique([provider, providerAccountId])");
    });

    it("has cascade delete on user relation", () => {
      expect(schema).toMatch(
        /user\s+User\s+@relation\(fields:\s*\[userId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/,
      );
    });
  });

  describe("Organization model", () => {
    it("has slug unique field", () => {
      expect(schema).toMatch(/slug\s+String\s+@unique/);
    });
  });

  describe("Membership model", () => {
    it("has unique constraint on userId+organizationId", () => {
      expect(schema).toContain("@@unique([userId, organizationId])");
    });

    it("uses MemberRole enum with default MEMBER", () => {
      expect(schema).toMatch(/role\s+MemberRole\s+@default\(MEMBER\)/);
    });
  });
});
