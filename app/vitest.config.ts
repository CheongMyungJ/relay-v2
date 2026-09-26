import { defineConfig } from 'vitest/config'

// 시험의 층 (docs/implementation.md 8.1).
// unit: core의 [단위]. Linux 러너에서 돈다.
// adapters: 실제 node-pty, 파일, git, 프로세스를 쓰는 [어댑터]. Windows 러너에서 돈다.
// flow: main 조립 + adapters + 가짜 claude의 [흐름]. Windows 러너에서 돈다 (I25, I26).
// claude: 실제 claude의 [실제]. 수동 워크플로 app-claude에서만 돈다 (I29).
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'test/unit/**/*.test.ts'],
        },
      },
      {
        test: { name: 'adapters', include: ['test/adapters/**/*.test.ts'], testTimeout: 60_000 },
      },
      {
        test: { name: 'flow', include: ['test/flow/**/*.test.ts'], testTimeout: 180_000 },
      },
      {
        test: {
          name: 'claude',
          include: ['test/claude/**/*.test.ts'],
          testTimeout: 3 * 60 * 60 * 1000,
        },
      },
    ],
  },
})
