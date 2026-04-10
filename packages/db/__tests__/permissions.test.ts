import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted ensures mock variables are initialised before vi.mock is hoisted
const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("../src/client.js", () => ({
  prisma: {
    relationTuple: {
      findFirst: mocks.findFirst,
      upsert: mocks.upsert,
      delete: mocks.delete,
      findMany: mocks.findMany,
    },
  },
}));

import {
  check,
  grant,
  revoke,
  listPermissions,
  hasOrgAccess,
} from "../src/permissions.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WI-008: ReBAC permissions", () => {
  describe("check()", () => {
    it("returns true when a matching tuple exists", async () => {
      mocks.findFirst.mockResolvedValue({ id: "t1" });

      const result = await check("org", "org-123", "member", "user", "u1");

      expect(result).toBe(true);
      expect(mocks.findFirst).toHaveBeenCalledWith({
        where: {
          namespace: "org",
          objectId: "org-123",
          relation: "member",
          subjectType: "user",
          subjectId: "u1",
        },
      });
    });

    it("returns false when no matching tuple exists", async () => {
      mocks.findFirst.mockResolvedValue(null);

      const result = await check("org", "org-123", "admin", "user", "u1");

      expect(result).toBe(false);
    });

    it("returns false (does not throw) on prisma error", async () => {
      mocks.findFirst.mockRejectedValue(new Error("DB error"));

      const result = await check("org", "org-123", "member", "user", "u1");

      expect(result).toBe(false);
    });
  });

  describe("grant()", () => {
    it("upserts a relation tuple", async () => {
      mocks.upsert.mockResolvedValue({ id: "t1" });

      await grant("org", "org-123", "member", "user", "u1");

      expect(mocks.upsert).toHaveBeenCalledWith({
        where: {
          namespace_objectId_relation_subjectType_subjectId: {
            namespace: "org",
            objectId: "org-123",
            relation: "member",
            subjectType: "user",
            subjectId: "u1",
          },
        },
        create: {
          namespace: "org",
          objectId: "org-123",
          relation: "member",
          subjectType: "user",
          subjectId: "u1",
        },
        update: {},
      });
    });

    it("is idempotent — calling twice does not throw", async () => {
      mocks.upsert.mockResolvedValue({ id: "t1" });

      await grant("org", "org-123", "member", "user", "u1");
      await grant("org", "org-123", "member", "user", "u1");

      expect(mocks.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe("revoke()", () => {
    it("deletes the matching relation tuple", async () => {
      mocks.delete.mockResolvedValue({ id: "t1" });

      await revoke("org", "org-123", "member", "user", "u1");

      expect(mocks.delete).toHaveBeenCalledWith({
        where: {
          namespace_objectId_relation_subjectType_subjectId: {
            namespace: "org",
            objectId: "org-123",
            relation: "member",
            subjectType: "user",
            subjectId: "u1",
          },
        },
      });
    });

    it("does not throw when tuple does not exist (P2025)", async () => {
      const notFoundErr = Object.assign(new Error("Record to delete not found"), {
        code: "P2025",
      });
      mocks.delete.mockRejectedValue(notFoundErr);

      await expect(
        revoke("org", "org-123", "member", "user", "u1"),
      ).resolves.toBeUndefined();
    });

    it("re-throws unexpected errors", async () => {
      mocks.delete.mockRejectedValue(new Error("Unexpected DB error"));

      await expect(
        revoke("org", "org-123", "member", "user", "u1"),
      ).rejects.toThrow("Unexpected DB error");
    });
  });

  describe("listPermissions()", () => {
    it("returns all tuples for a subject", async () => {
      mocks.findMany.mockResolvedValue([
        { namespace: "org", objectId: "org-1", relation: "member" },
        { namespace: "project", objectId: "proj-1", relation: "lead" },
      ]);

      const result = await listPermissions("user", "u1");

      expect(result).toEqual([
        { namespace: "org", objectId: "org-1", relation: "member" },
        { namespace: "project", objectId: "proj-1", relation: "lead" },
      ]);
      expect(mocks.findMany).toHaveBeenCalledWith({
        where: { subjectType: "user", subjectId: "u1" },
        select: { namespace: true, objectId: true, relation: true },
      });
    });

    it("returns empty array when subject has no permissions", async () => {
      mocks.findMany.mockResolvedValue([]);

      const result = await listPermissions("user", "nobody");

      expect(result).toEqual([]);
    });
  });

  describe("hasOrgAccess()", () => {
    it("returns true when user has member relation on org", async () => {
      mocks.findFirst.mockResolvedValue({ id: "t1" });

      const result = await hasOrgAccess("u1", "org-123");

      expect(result).toBe(true);
      expect(mocks.findFirst).toHaveBeenCalledWith({
        where: {
          namespace: "org",
          objectId: "org-123",
          relation: "member",
          subjectType: "user",
          subjectId: "u1",
        },
      });
    });

    it("returns false when user has no relation on org", async () => {
      mocks.findFirst.mockResolvedValue(null);

      const result = await hasOrgAccess("u1", "org-999");

      expect(result).toBe(false);
    });
  });

  describe("schema: RelationTuple model", () => {
    it("RelationTuple model is defined in schema.prisma", async () => {
      const { readFileSync } = await import("fs");
      const { resolve } = await import("path");
      const schema = readFileSync(
        resolve(__dirname, "../prisma/schema.prisma"),
        "utf-8",
      );
      expect(schema).toMatch(/model\s+RelationTuple\s*\{/);
    });

    it("RelationTuple has composite unique constraint", async () => {
      const { readFileSync } = await import("fs");
      const { resolve } = await import("path");
      const schema = readFileSync(
        resolve(__dirname, "../prisma/schema.prisma"),
        "utf-8",
      );
      expect(schema).toContain(
        "@@unique([namespace, objectId, relation, subjectType, subjectId])",
      );
    });
  });
});
