// [실제] 앱이 충돌한 뒤 다시 켜서 [재개]로 이어 간다 (docs/implementation.md M6, 8.4, 시나리오 9, D75, D76).
// 앱(Relay)을 자식 프로세스(app-process.mjs)로 띄워 S 요청 레포의 intake가 첫 요청을 받아 일하는 중에 그 프로세스만
// SIGKILL로 끝낸다(트리 종료 아님). 다시 켜면 조정과 고아 확인을 한다: 기록과 시작 시각이 같은 claude가 남았으면
// 트리째 끝내고 알린다. 중단됨이 된 intake를 [재개]로 같은 세션(--resume)으로 연다. 앱이 이어서 하라는 첫 입력을
// 주므로(D218) 사람은 치지 않고 Work 완료까지 간다. 앱이 죽은 뒤 claude가 남았는지, 재시작이 한 일, pty.log 끝의
// 표시 줄(D219)을 결과에 적는다.
// RELAY_REAL_CLAUDE=1이면 실제 claude, dry면 가짜 claude로 도구만 확인한다. RELAY_REAL_CASES로 고른다(restart).
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { isAlive, listProcesses } from '../../src/adapters/pty'
import type { NoticeView, TaskView } from '../../src/shared/views'
import type { LifecycleEvent, WorkState } from '../../src/shared/work'
import { drive, type DriveResult } from '../flow/driver'
import {
  APP,
  FAKE_CLAUDE,
  SKILLS,
  harness,
  makeRepo,
  register,
  settle,
  sleep,
} from '../flow/harness'
import { scenario, steps, type Scenario } from '../flow/scenarios'
import { S_CASE } from './repos'
import { ScreenUi } from './screen'

const mode = process.env['RELAY_REAL_CLAUDE']
const dry = mode === 'dry'
const cases = (process.env['RELAY_REAL_CASES'] ?? '').split(/[\s,]+/).filter(Boolean)
const enabled = (mode === '1' || dry) && (cases.length === 0 || cases.includes('restart'))
const OUT = path.join(APP, 'test-results', 'claude')
const APP_PROCESS = path.join(APP, 'test/claude/app-process.mjs')
const TASK_TIMEOUT_MS = 25 * 60 * 1000
/** 첫 요청을 받은 뒤 앱을 끝내기까지 기다리는 시간. 에이전트가 일하는 도중에 끊는다 */
const WORK_MS = dry ? 1000 : 10_000
/** handoff 없이 턴이 끝났을 때 사람이 보내는 말 (real.test.ts와 같음) */
const NUDGE = '스킬의 절차를 계속해 주세요. 마치면 종료 절차대로 handoff를 쓰고 턴을 끝내 주세요.'

/** 가짜 claude의 시나리오 (dry): 첫 세션은 요청을 받고 멈춰 있고, 다시 연 세션이 intake를 마친다 */
function dryScenario(): Scenario {
  return {
    tasks: { ...scenario().tasks, 'work-start': [{ do: 'prompt' }, { do: 'wait' }] },
    // 다시 연 세션은 앱이 준 이어서 하라는 입력(D218)을 받고 intake를 마친다
    resume: { 'work-start': steps('intake').slice(1) },
  }
}

interface Ready {
  workKey: string
  status: string | null
  pid: number | null
  startedAt: string | null
  screen: string
}

/** 재시작이 한 일 */
interface Restart {
  /** 앱 프로세스가 준비됐다고 알린 때의 intake 상태 */
  before: string | null
  /** 앱을 끝내고 3초 뒤 기록한 claude가 살아 있었다. 시작 시각이 없으면 null */
  survived: boolean | null
  /** 다시 켠 뒤 그 claude가 살아 있다 */
  aliveAfter: boolean | null
  status: string | null
  event: LifecycleEvent | null
  notices: NoticeView[]
  resumed: boolean
  sameSession: boolean | null
  /** 다시 켠 뒤 intake 세션 기록의 app_ended (D219) */
  appEnded: string | null
  /** 다시 켠 뒤 pty.log가 앱이 꺼졌다는 표시 줄로 끝남 (D219) */
  endMark: boolean
}

interface Timing {
  step: string
  ms: number
}

describe.runIf(enabled)('[실제] 앱이 충돌한 뒤 [재개] (M6, 시나리오 9)', () => {
  it('일하는 중에 앱 프로세스를 SIGKILL로 끝낸 뒤 다시 켜면 조정하고, [재개]로 이어 Work 완료까지 간다', async () => {
    const h = await harness(
      dry
        ? { ui: new ScreenUi(), claudeBin: FAKE_CLAUDE, scenario: dryScenario() }
        : { ui: new ScreenUi(), claudeBin: process.env['CLAUDE_BIN'] ?? null },
    )
    const dir = path.join(OUT, 'restart')
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
    const timings: Timing[] = []
    let mark = Date.now()
    const lap = (step: string) => {
      const now = Date.now()
      timings.push({ step, ms: now - mark })
      mark = now
    }
    const facts: Restart = {
      before: null,
      survived: null,
      aliveAfter: null,
      status: null,
      event: null,
      notices: [],
      resumed: false,
      sameSession: null,
      appEnded: null,
      endMark: false,
    }
    let ui = new ScreenUi()
    let child: ChildProcess | null = null
    let workDir: string | null = null
    let result: DriveResult | null = null
    let error: string | null = null
    try {
      const { repo } = makeRepo(h.root, S_CASE.repo, S_CASE.files)
      const projectId = await register(h, repo)
      // 이 프로세스의 앱은 끄고, 앱 역할 프로세스가 Work를 만들고 intake를 띄운다
      await h.relay.close()
      const ready = path.join(h.root, 'ready.json')
      const config = path.join(h.root, 'app-process.json')
      fs.writeFileSync(
        config,
        JSON.stringify({
          app: APP,
          home: h.home,
          skills: SKILLS,
          projectId,
          request: S_CASE.request,
          ready,
          timeoutMs: 10 * 60 * 1000,
          workMs: WORK_MS,
        }),
      )
      const log = fs.openSync(path.join(dir, 'app-process.log'), 'w')
      const app = spawn(process.execPath, [APP_PROCESS, config], {
        env: h.env,
        stdio: ['ignore', log, log],
      })
      child = app
      const info = await readyFile(ready, app, 12 * 60 * 1000)
      fs.closeSync(log)
      facts.before = info.status
      const key = info.workKey
      const term = `${key}/t-01`
      workDir = path.join(h.home, 'projects', projectId, 'works', key.split('/')[1] ?? '')
      const before = work(workDir).tasks[0]?.session
      lap('첫 요청을 받아 일하는 중')

      // 앱 충돌: 앱 프로세스만 SIGKILL로 끝낸다
      app.kill('SIGKILL')
      await exited(app)
      await sleep(3000)
      if (info.pid && info.startedAt) {
        facts.survived = isAlive(info.pid, info.startedAt, await listProcesses())
      }
      lap('앱 강제 종료')

      // 다시 켠다: 고아 확인과 조정 (시나리오 9)
      ui = new ScreenUi()
      await h.reopen(ui)
      await settle(h, key)
      if (info.pid && info.startedAt) {
        facts.aliveAfter = isAlive(info.pid, info.startedAt, await listProcesses())
      }
      const view = h.relay.snapshot().works.find((w) => w.key === key)
      facts.notices = view?.notices ?? []
      facts.status = work(workDir).tasks[0]?.status ?? null
      facts.event = events(workDir).at(-1) ?? null
      facts.appEnded = work(workDir).tasks[0]?.session?.app_ended ?? null
      facts.endMark = fs
        .readFileSync(path.join(workDir, 'tasks', '01-intake', 'pty.log'), 'utf8')
        .endsWith('── relay: 앱이 꺼져 세션이 여기서 끝났습니다 ──\x1b[0m\r\n')
      lap('다시 켬')

      // 중단됨이면 [재개]: 같은 세션을 --resume으로 열고 앱이 이어서 하라는 입력을 준다 (D218)
      const task = (): TaskView | undefined =>
        h.relay.snapshot().works.find((w) => w.key === key)?.tasks[0]
      if (facts.status === 'interrupted') {
        const r = await h.relay.resume(key, 't-01')
        if (!r.ok) throw new Error(`재개 실패: ${r.error}`)
        await ui.until(() => task()?.live, '다시 연 세션', 120_000)
        facts.resumed = true
        const after = work(workDir).tasks[0]?.session
        facts.sameSession = after?.id === before?.id && after?.resumed_at !== undefined
        await ui.until(
          () => task()?.status === 'working',
          '앱이 준 이어서 하라는 입력',
          120_000,
          () => ui.handleDialogs(h.relay, term),
        )
        lap('재개')
      }
      result = await drive(h.relay, ui, key, {
        force: true,
        nudge: NUDGE,
        maxNudges: 2,
        stepTimeoutMs: TASK_TIMEOUT_MS,
        tick: async (t) => {
          if (t.status !== 'asking') await ui.handleDialogs(h.relay, t.terminal)
        },
      })
      await settle(h, key)
      lap('Work 완료까지')
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    } finally {
      if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
      if (workDir && fs.existsSync(workDir))
        fs.cpSync(workDir, path.join(dir, 'work'), { recursive: true })
      fs.writeFileSync(path.join(dir, 'ui.txt'), ui.dump())
      await h.close()
      const text = summary(facts, result, error, timings)
      fs.writeFileSync(path.join(OUT, 'restart.md'), text)
      console.log(text)
    }
    expect(error).toBeNull()
    expect(result?.status).toBe('completed')
    // 살아남은 claude는 재시작이 끝내고 알린다. 남지 않았으면 끝낸 것이 없다 (D76)
    expect(facts.aliveAfter ?? false).toBe(false)
    expect(facts.notices.some((n) => n.kind === 'orphans')).toBe(facts.survived === true)
    expect(facts.event).toMatchObject({ payload: { reason: 'app_restart' } })
    expect(facts.appEnded).toBe('restart')
    expect(facts.endMark).toBe(true)
    if (facts.resumed) expect(facts.sameSession).toBe(true)
  })
})

function work(dir: string): WorkState {
  return JSON.parse(fs.readFileSync(path.join(dir, 'work.json'), 'utf8')) as WorkState
}

function events(dir: string): LifecycleEvent[] {
  return fs
    .readFileSync(path.join(dir, 'events.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LifecycleEvent)
}

/** 앱 역할 프로세스가 준비됐다고 쓸 때까지 기다린다. 먼저 끝나면 실패다 */
async function readyFile(file: string, app: ChildProcess, ms: number): Promise<Ready> {
  const end = Date.now() + ms
  for (;;) {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')) as Ready
    if (app.exitCode !== null || app.signalCode !== null) {
      throw new Error(`앱 역할 프로세스가 먼저 끝남 (종료 코드 ${String(app.exitCode)})`)
    }
    if (Date.now() > end) throw new Error('시간 초과: 앱 역할 프로세스')
    await sleep(500)
  }
}

function exited(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) resolve()
    else child.once('exit', () => resolve())
  })
}

const seconds = (ms: number) => `${Math.round(ms / 1000)}초`
const yesNo = (v: boolean | null) => (v === null ? '알 수 없음' : v ? '예' : '아니오')

function summary(
  f: Restart,
  result: DriveResult | null,
  error: string | null,
  timings: Timing[],
): string {
  const env = process.env
  const ok = !error && result?.status === 'completed'
  return [
    '# relay [실제] 재시작 결과',
    '',
    `- 날짜: ${new Date().toISOString()}`,
    `- 앱 커밋: ${env['GITHUB_SHA'] ?? '(로컬)'}`,
    `- OS: ${process.platform} ${env['ImageOS'] ?? ''} ${env['ImageVersion'] ?? ''}`.trimEnd(),
    `- 모델: ${env['ANTHROPIC_MODEL'] ?? '(기본)'}, effort: ${env['CLAUDE_CODE_EFFORT_LEVEL'] ?? '(기본)'}`,
    ...(dry ? ['- 가짜 claude로 돌린 도구 확인 (dry)'] : []),
    '',
    `- 결과: ${ok ? '통과' : `실패 (${error ?? result?.reason ?? result?.status ?? '알 수 없음'})`}`,
    `- 앱을 끝낼 때 intake: ${f.before ?? '알 수 없음'}`,
    `- 앱을 끝낸 뒤 claude가 남음: ${yesNo(f.survived)}`,
    `- 다시 켠 뒤 그 claude가 살아 있음: ${yesNo(f.aliveAfter)}`,
    `- 다시 켠 뒤 intake: ${f.status ?? '알 수 없음'} (이벤트 ${f.event ? `${f.event.type} ${JSON.stringify(f.event.payload)}` : '없음'})`,
    `- 알림: ${f.notices.length ? f.notices.map((n) => `${n.title}: ${n.lines.join(', ')}`).join(' / ') : '없음'}`,
    `- 앱이 꺼져 끝남(app_ended): ${f.appEnded ?? '없음'}, pty.log 끝의 표시 줄: ${yesNo(f.endMark)}`,
    `- [재개]: ${f.resumed ? `함(같은 세션: ${yesNo(f.sameSession)}, 사람은 치지 않음)` : '안 함'}`,
    '',
    '| 단계 | 걸린 시간 |',
    '|---|---|',
    ...timings.map((t) => `| ${t.step} | ${seconds(t.ms)} |`),
    '',
    ...(result
      ? [
          '| task | 형식 오류 되돌림 | 오류 무시하고 승인 | 질문 답 | 재촉 | 걸린 시간 |',
          '|---|---|---|---|---|---|',
          ...result.tasks.map(
            (t) =>
              `| ${t.label} | ${t.bounces} | ${t.forced ? '씀' : '0'} | ${t.answers} | ${t.nudges} | ${seconds(t.ms)} |`,
          ),
          '',
        ]
      : []),
  ].join('\n')
}
