/**
 * auth.test.ts — Auth.js v5 Split Config unit tests
 *
 * Tests:
 * 1. authConfig is Edge-compatible (no Prisma import)
 * 2. authConfig.callbacks.jwt adds userId
 * 3. authConfig.callbacks.authorized guards protected routes
 * 4. getCurrentUser returns null when auth() returns no session
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock: next-auth — avoid real OAuth / DB calls
// ---------------------------------------------------------------------------
vi.mock("next-auth", () => {
  return {
    default: vi.fn(() => ({
      auth: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
      handlers: { GET: vi.fn(), POST: vi.fn() },
    })),
  };
});

// Mock: @auth/prisma-adapter
vi.mock("@auth/prisma-adapter", () => ({
  PrismaAdapter: vi.fn(() => ({})),
}));

// Mock: @axle/db — stub prisma client
vi.mock("@axle/db", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    membership: { findFirst: vi.fn() },
  },
  DB_PACKAGE: "@axle/db",
}));

// Mock: next/navigation — redirect throws in Next.js, replicate that here
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

// Mock: react cache — passthrough in tests
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("authConfig (Edge-compatible)", () => {
  it("has correct signIn page", async () => {
    const { authConfig } = await import("../src/auth.config.js");
    expect(authConfig.pages?.signIn).toBe("/login");
  });

  it("has jwt strategy", async () => {
    const { authConfig } = await import("../src/auth.config.js");
    expect(authConfig.session?.strategy).toBe("jwt");
  });

  it("jwt callback adds userId from user object", async () => {
    const { authConfig } = await import("../src/auth.config.js");
    const jwt = authConfig.callbacks?.jwt;
    if (!jwt) throw new Error("jwt callback missing");

    const result = await jwt({
      token: { sub: "tok-123" },
      user: { id: "user-abc", email: "a@test.com" },
      account: null,
      trigger: "signIn",
    });

    expect(result!.userId).toBe("user-abc");
  });

  it("jwt callback is a no-op when user is absent", async () => {
    const { authConfig } = await import("../src/auth.config.js");
    const jwt = authConfig.callbacks?.jwt;
    if (!jwt) throw new Error("jwt callback missing");

    const token = { sub: "tok-123", userId: "existing-id" };
    const result = await jwt({
      token,
      user: undefined as unknown as { id: string; email: string },
      account: null,
      trigger: "update",
    });

    expect(result!.userId).toBe("existing-id");
  });

  describe("authorized callback", () => {
    async function callAuthorized(pathname: string, hasUser: boolean) {
      const { authConfig } = await import("../src/auth.config.js");
      const authorized = authConfig.callbacks?.authorized;
      if (!authorized) throw new Error("authorized callback missing");

      return authorized({
        auth: hasUser ? { user: { id: "u1", name: "Test", email: "t@t.com" }, expires: "" } : null,
        request: {
          nextUrl: { pathname } as URL,
        },
      } as Parameters<NonNullable<typeof authorized>>[0]);
    }

    it("allows unauthenticated access to public routes", async () => {
      expect(await callAuthorized("/login", false)).toBe(true);
      expect(await callAuthorized("/", false)).toBe(true);
    });

    it("blocks unauthenticated access to /dashboard", async () => {
      expect(await callAuthorized("/dashboard", false)).toBe(false);
    });

    it("allows authenticated access to /dashboard", async () => {
      expect(await callAuthorized("/dashboard", true)).toBe(true);
    });

    it("blocks unauthenticated access to /settings", async () => {
      expect(await callAuthorized("/settings/profile", false)).toBe(false);
    });
  });
});

describe("index exports", () => {
  it("exports authConfig", async () => {
    const mod = await import("../src/index.js");
    expect(mod.authConfig).toBeDefined();
    expect(typeof mod.authConfig).toBe("object");
  });

  it("exports getCurrentUser function", async () => {
    const mod = await import("../src/index.js");
    expect(typeof mod.getCurrentUser).toBe("function");
  });

  it("exports requireUser function", async () => {
    const mod = await import("../src/index.js");
    expect(typeof mod.requireUser).toBe("function");
  });

  it("exports requireOrg function", async () => {
    const mod = await import("../src/index.js");
    expect(typeof mod.requireOrg).toBe("function");
  });

  it("exports getCachedSession function", async () => {
    const mod = await import("../src/index.js");
    expect(typeof mod.getCachedSession).toBe("function");
  });

  it("exports invalidateCachedSession function", async () => {
    const mod = await import("../src/index.js");
    expect(typeof mod.invalidateCachedSession).toBe("function");
  });
});

describe("getCurrentUser", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns null when auth() returns no session", async () => {
    // Re-mock next-auth to return a null session
    vi.mock("next-auth", () => ({
      default: vi.fn(() => ({
        auth: vi.fn().mockResolvedValue(null),
        signIn: vi.fn(),
        signOut: vi.fn(),
        handlers: {},
      })),
    }));

    // Import dal after mock is set up
    const { getCurrentUser } = await import("../src/dal.js");
    const user = await getCurrentUser();
    expect(user).toBeNull();
  });
});
