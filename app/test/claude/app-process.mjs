// [실제] 재시작 시험의 앱 역할 프로세스 (docs/implementation.md M6 8.4, 시나리오 9). 시험(restart.test.ts)이
// 띄우고 SIGKILL로 끝내 앱 충돌을 흉내 낸다. Vite의 SSR 모듈 로더로 앱의 main 조립(Relay)과 시험 도구의 화면
// 읽기(ScreenUi)를 TypeScript 그대로 불러, 이 프로세스가 앱처럼 Work를 만들고 intake 세션을 띄운다.
// 첫 실행 창은 수락하고(I17), intake가 첫 요청을 받아 일하기 시작하면(UserPromptSubmit) 조금 더 둔 뒤
// 세션의 프로세스 ID와 시작 시각을 파일에 쓰고 끝날 때까지 살아 있는다. 출처: spikes/lib/orphan-parent.mjs
import fs from 'node:fs'
import { createServer } from 'vite'

const cfg = JSON.parse(fs.readFileSync(process.argv[2] ?? '', 'utf8'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const server = await createServer({
  configFile: false,
  root: cfg.app,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
  // @xterm/headless의 module 항목은 패키지에 없는 파일을 가리킨다. Node가 main으로 불러오게 둔다
  ssr: { external: ['@xterm/headless'] },
})
const { Relay } = await server.ssrLoadModule('/src/main/relay.ts')
const { ScreenUi } = await server.ssrLoadModule('/test/claude/screen.ts')

const ui = new ScreenUi()
const relay = await Relay.open({ home: cfg.home, skills: cfg.skills, ui, env: process.env })
const created = await relay.createWork(cfg.projectId, {
  request: cfg.request,
  baseBranch: 'main',
  baseLocation: 'local',
})
if (!created.ok) {
  console.error(`Work 생성 실패: ${created.error}`)
  process.exit(1)
}
const key = created.workKey
const term = `${key}/t-01`
const intake = () => relay.work(key)?.work.tasks[0]
console.log(`Work ${key}`)

// 첫 요청을 받아 일하기 시작할 때까지 첫 실행 창을 수락한다
const end = Date.now() + cfg.timeoutMs
while (!intake()?.last_prompt_at) {
  if (Date.now() > end) {
    console.error(`시간 초과: 첫 요청\n${ui.dump()}`)
    process.exit(1)
  }
  await ui.handleDialogs(relay, term)
  await sleep(500)
}
// 일하는 도중에 끊기게 조금 더 둔다
const working = Date.now()
while (Date.now() - working < cfg.workMs) {
  await ui.handleDialogs(relay, term)
  await sleep(500)
}
const task = intake()
fs.writeFileSync(
  cfg.ready,
  JSON.stringify({
    workKey: key,
    status: task?.status ?? null,
    pid: task?.session?.pid ?? null,
    startedAt: task?.session?.process_started_at ?? null,
    screen: ui.screen(term),
  }),
)
console.log(`준비됨: ${task?.status} PID ${task?.session?.pid}`)
// 시험이 SIGKILL로 끝낼 때까지 산다
setInterval(() => void ui.handleDialogs(relay, term), 1000)
