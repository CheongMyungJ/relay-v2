import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: ['test/smoke/**', '**/node_modules/**'],
    // M1 전까지는 시험이 없다.
    passWithNoTests: true,
  },
})
