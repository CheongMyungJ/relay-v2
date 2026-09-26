import { defineConfig } from 'vitest/config'

// 시험의 층 (docs/implementation.md 8.1).
// unit: core의 [단위]. Linux 러너에서 돈다.
// adapters: 실제 node-pty, 파일, 프로세스를 쓰는 [어댑터]. Windows 러너에서 돈다.
export default defineConfig({
  test: {
    // M1 전까지는 core 시험이 없다.
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'test/unit/**/*.test.ts'],
        },
      },
      {
        test: { name: 'adapters', include: ['test/adapters/**/*.test.ts'], testTimeout: 30000 },
      },
    ],
  },
})
