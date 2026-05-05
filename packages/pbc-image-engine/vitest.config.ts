import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    // *.live.test.ts hits real APIs — only the integration runner picks them up.
    // The fixture-based smoke tests under __tests__/integration/ stay in the
    // default suite so CI exercises the captured response shapes on every push.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/__tests__/integration/*.live.test.ts",
    ],
  },
});
