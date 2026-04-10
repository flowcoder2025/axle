import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    env: {
      GEMINI_API_KEY: "test-gemini-key",
      DATA_GO_KR_API_KEY: "test-data-go-kr-key",
    },
  },
});
