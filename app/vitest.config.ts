import { defineConfig } from 'vitest/config'

// 시험의 층 (docs/implementation.md 8.1).
// unit: core의 [단위]. Linux 러너에서 돈다.
// adapters: 실제 node-pty, 파일, git, 프로세스를 쓰는 [어댑터]. Windows 러너에서 돈다.
// flow: main 조립 + adapters + 가짜 claude의 [흐름]. Windows 러너에서 돈다 (I25, I26).
// claude: 실제 claude의 [실제]. RELAY_REAL_CLAUDE가 있을 때만 수동으로 돈다(app-claude 워크플로나 Linux 세션, I29, 8.4).
// contract: [계약]. 가짜 claude가 계약(test/contract/claude.ts)과 실제 녹화본을 따르는지(fakes, Linux 러너). 실제 claude가
//   계약을 지키는지(live)는 RELAY_CONTRACT_LIVE=1일 때만 돈다(app-claude 워크플로).
// eval: 평가 도구(eval/)의 측정 로직. 모델을 부르지 않는다(docs/eval.md 6절). Linux 러너에서 돈다.
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
        // 흐름 시험은 PTY와 git을 많이 띄우므로 파일을 차례로 돌린다
        test: {
          name: 'flow',
          include: ['test/flow/**/*.test.ts'],
          testTimeout: 180_000,
          fileParallelism: false,
        },
      },
      {
        test: {
          name: 'contract',
          include: ['test/contract/**/*.test.ts'],
          testTimeout: 10 * 60 * 1000,
          fileParallelism: false,
        },
      },
      {
        test: { name: 'eval', include: ['eval/test/**/*.test.mjs'], testTimeout: 60_000 },
      },
      {
        test: {
          name: 'claude',
          include: ['test/claude/**/*.test.ts'],
          testTimeout: 3 * 60 * 60 * 1000,
          fileParallelism: false,
        },
      },
    ],
  },
})
