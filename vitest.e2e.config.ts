import { defineConfig } from 'vitest/config'

// Separate config for E2E so the default `npm test` stays fast.
// E2E tests live in e2e/, build dist/ as a prerequisite, and launch
// real Chromium with the unpacked extension loaded (see e2e/helpers.ts).
export default defineConfig({
  test: {
    include: ['e2e/**/*.test.ts'],
    environment: 'node',
    // Each test launches its own Chromium; serial keeps memory + port use
    // predictable on CI.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
})
