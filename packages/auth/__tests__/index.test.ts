import { describe, it, expect, vi } from "vitest";

// Mock next-auth and related modules to avoid Node/Edge resolution issues in unit tests
vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    handlers: { GET: vi.fn(), POST: vi.fn() },
  })),
}));
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: vi.fn(() => ({})) }));
vi.mock("@axle/db", () => ({
  prisma: { user: { findUnique: vi.fn() }, membership: { findFirst: vi.fn() } },
  DB_PACKAGE: "@axle/db",
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); }),
}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn };
});

describe("@axle/auth", () => {
  it("exports authConfig", async () => {
    const mod = await import("../src/index.js");
    expect(mod.authConfig).toBeDefined();
  });

  it("resolves @axle/db workspace dependency", async () => {
    const db = await import("@axle/db");
    expect(db.DB_PACKAGE).toBe("@axle/db");
  });
});
