import { defineConfig } from "vitest/config";

/**
 * Live integration test runner — invoked via `npm run test:integration`.
 * Picks up only `*.live.test.ts` files; each one self-skips when the
 * required env var is missing, so a no-secret invocation is a no-op rather
 * than a failure.
 */
export default defineConfig({
  test: {
    globals: true,
    include: ["__tests__/integration/*.live.test.ts"],
    // Live calls are slow + we never want them to hang CI: 10 min wall ceiling.
    testTimeout: 10 * 60 * 1000,
    hookTimeout: 30_000,
  },
});
