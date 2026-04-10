import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const PACKAGE_ROOT = resolve(__dirname, "..");

describe("Prisma 7 Client Engine + Driver Adapter setup", () => {
  describe("schema.prisma", () => {
    const schemaPath = resolve(PACKAGE_ROOT, "prisma/schema.prisma");

    it("exists at packages/db/prisma/schema.prisma", () => {
      expect(existsSync(schemaPath)).toBe(true);
    });

    it("uses postgresql provider with DATABASE_URL and DIRECT_URL", () => {
      const schema = readFileSync(schemaPath, "utf-8");
      expect(schema).toContain('provider  = "postgresql"');
      expect(schema).toContain('env("DATABASE_URL")');
      expect(schema).toContain('env("DIRECT_URL")');
    });

    it("uses Client Engine (engineType = client)", () => {
      const schema = readFileSync(schemaPath, "utf-8");
      expect(schema).toContain('engineType = "client"');
    });
  });

  describe("client module", () => {
    it("exports createPrismaClient factory function", async () => {
      const mod = await import("../src/client.js");
      expect(mod.createPrismaClient).toBeDefined();
      expect(typeof mod.createPrismaClient).toBe("function");
    });

    it("exports prisma singleton getter", async () => {
      const mod = await import("../src/index.js");
      expect(mod.prisma).toBeDefined();
    });
  });

  describe("package.json", () => {
    const pkg = JSON.parse(
      readFileSync(resolve(PACKAGE_ROOT, "package.json"), "utf-8"),
    );

    it("has @prisma/client as dependency", () => {
      expect(pkg.dependencies["@prisma/client"]).toBeDefined();
    });

    it("has @prisma/adapter-pg as dependency", () => {
      expect(pkg.dependencies["@prisma/adapter-pg"]).toBeDefined();
    });

    it("has pg as dependency", () => {
      expect(pkg.dependencies["pg"]).toBeDefined();
    });

    it("has prisma as devDependency", () => {
      expect(pkg.devDependencies["prisma"]).toBeDefined();
    });

    it("has db:generate script", () => {
      expect(pkg.scripts["db:generate"]).toBeDefined();
    });

    it("has db:push script", () => {
      expect(pkg.scripts["db:push"]).toBeDefined();
    });
  });
});
