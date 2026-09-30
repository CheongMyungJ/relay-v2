import { defineConfig } from '@playwright/test'

// [스모크] (I27). RELAY_APP_EXE가 있으면 설치된 앱을, 없으면 out/의 빌드를 개발용 electron으로 띄운다.
export default defineConfig({
  testDir: 'test/smoke',
  timeout: 90_000,
  retries: 0,
  // 앱의 single instance 잠금 때문에 서로 다른 스모크 파일도 함께 띄우지 않는다.
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'test-results/html' }]],
  outputDir: 'test-results/artifacts',
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
})
