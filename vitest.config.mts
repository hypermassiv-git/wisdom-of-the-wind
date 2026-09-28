import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": import.meta.dirname,
      // Next's server-only guard throws outside a server bundle; it's a no-op in tests.
      "server-only": `${import.meta.dirname}/tests/server-only-stub.ts`,
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // Live chain checks run only via `npm run check:live`.
    exclude: process.env.LIVE ? [] : ["tests/live/**"],
    testTimeout: process.env.LIVE ? 120_000 : 5_000,
  },
});
