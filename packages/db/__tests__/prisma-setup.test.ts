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

    it("uses postgresql provider (Prisma 7: URLs moved to prisma.config.ts)", () => {
      const schema = readFileSync(schemaPath, "utf-8");
      expect(schema).toContain('provider = "postgresql"');
      // Prisma 7: url and directUrl are no longer in schema datasource block
      // They are configured in prisma.config.ts via defineConfig()
      expect(schema).not.toContain('env("DATABASE_URL")');
      expect(schema).not.toContain('directUrl');
    });

    it("has prisma.config.ts with DATABASE_URL", () => {
      const configPath = resolve(PACKAGE_ROOT, "prisma.config.ts");
      expect(existsSync(configPath)).toBe(true);
      const config = readFileSync(configPath, "utf-8");
      expect(config).toContain("DATABASE_URL");
      expect(config).toContain("defineConfig");
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

    it("has db:migrate script (Prisma Migrate replaces db push as of WI-720)", () => {
      expect(pkg.scripts["db:migrate"]).toBeDefined();
    });

    it("has db:migrate:deploy script", () => {
      expect(pkg.scripts["db:migrate:deploy"]).toBeDefined();
    });

    it("has db:migrate:status script", () => {
      expect(pkg.scripts["db:migrate:status"]).toBeDefined();
    });
  });
});
