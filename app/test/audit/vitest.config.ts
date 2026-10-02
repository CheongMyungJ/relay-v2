import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/audit/*.test.ts'],
    testTimeout: 180_000,
    fileParallelism: false,
  },
})
