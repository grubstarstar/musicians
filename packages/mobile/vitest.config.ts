import { defineConfig } from "vitest/config";

// Mobile runs as Expo/React Native, so we only test pure helpers that have
// no React Native imports. Scope to `src/utils/` to keep vitest from trying
// to parse Expo Router / RN sources.
export default defineConfig({
  test: {
    include: ["src/utils/**/*.test.ts"],
  },
});
