import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  timeout: 30_000,
  workers: 1,
  retries: 0,
  outputDir: '../../audit-artifacts/gui-traces',
  reporter: [['list'], ['json', { outputFile: '../../audit-artifacts/gui.json' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
})
