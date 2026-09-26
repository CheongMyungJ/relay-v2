// [실제] 트리 종료한 세션을 --resume으로 다시 열면 대화가 이어진다 (docs/implementation.md M3, S6).
// 앱의 흐름 그대로: intake 세션에 표식을 알려 준 뒤 [즉시 중단](트리 종료)하고 [재개]한다. 다시 연 세션에
// 표식을 파일에 쓰게 해 파일로 판정한다(화면에는 앞 대화가 다시 보이므로 화면으로는 가를 수 없음).
// 자동 메모리는 task 설정 파일이 끈다(D113). 켜져 있으면 답이 대화가 아니라 메모리에서 올 수 있다(S6).
// RELAY_REAL_CLAUDE=1이면 실제 claude, dry면 가짜 claude로 도구만 확인한다. RELAY_REAL_CASES로 고른다.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Relay } from '../../src/main/relay'
import type { TaskView } from '../../src/shared/views'
import type { WorkState } from '../../src/shared/work'
import { APP, FAKE_CLAUDE, harness, makeRepo, register, settle, sleep } from '../flow/harness'
import { steps, type Scenario } from '../flow/scenarios'
import { S_CASE } from './repos'
import { ScreenUi } from './screen'

const mode = process.env['RELAY_REAL_CLAUDE']
const dry = mode === 'dry'
const cases = (process.env['RELAY_REAL_CASES'] ?? '').split(/[\s,]+/).filter(Boolean)
const enabled = (mode === '1' || dry) && (cases.length === 0 || cases.includes('resume'))
const OUT = path.join(APP, 'test-results', 'claude')
const STEP_TIMEOUT_MS = 10 * 60 * 1000
const MARK = 'RELAY-RESUME-4217'
const CHECK_FILE = 'resume-check.txt'
/** 입력란 아래 상태 줄. 입력을 받을 수 있는지 본다. 출처: spikes/lib/session.mjs READY_HINT */
const READY_HINT = /for agents|for shortcuts|shift\+tab to cycle/i
/** 턴이 끝나 사람을 기다리는 상태 */
const TURN_ENDED = new Set(['awaiting_approval', 'idle', 'blocked', 'session_ended'])

/** 가짜 claude의 시나리오 (dry): 사람이 보낸 두 요청을 흉내 낸다 */
function dryScenario(): Scenario {
  return {
    tasks: {
      'work-start': [
        ...steps('intake', 'S'),
        { do: 'waitEnter' },
        { do: 'prompt' },
        { do: 'stop' },
      ],
    },
    resume: {
      'work-start': [
        { do: 'waitEnter' },
        { do: 'prompt' },
        { do: 'write', file: CHECK_FILE, text: `${MARK}\n` },
        { do: 'stop' },
      ],
    },
  }
}

interface Timing {
  step: string
  ms: number
}

describe.runIf(enabled)('[실제] 트리 종료한 세션의 --resume (M3, S6)', () => {
  it('트리 종료한 세션을 --resume으로 다시 열면 대화가 이어진다', async () => {
    const ui = new ScreenUi()
    const h = await harness(
      dry
        ? { ui, claudeBin: FAKE_CLAUDE, scenario: dryScenario() }
        : { ui, claudeBin: process.env['CLAUDE_BIN'] ?? null },
    )
    const timings: Timing[] = []
    let mark = Date.now()
    const lap = (step: string) => {
      const now = Date.now()
      timings.push({ step, ms: now - mark })
      mark = now
    }
    const dir = path.join(OUT, 'resume')
    let workDir: string | null = null
    let answer: string | null = null
    let error: string | null = null
    try {
      const { repo } = makeRepo(h.root, S_CASE.repo, S_CASE.files)
      const projectId = await register(h, repo)
      const created = await h.relay.createWork(projectId, {
        request: S_CASE.request,
        baseBranch: 'main',
        baseLocation: 'local',
      })
      if (!created.ok) throw new Error(`Work 생성 실패: ${created.error}`)
      const key = created.workKey
      workDir = path.join(h.home, 'projects', projectId, 'works', key.split('/')[1] ?? '')
      const term = `${key}/t-01`
      const task = (): TaskView | undefined => ui.works.get(key)?.tasks[0]

      // 1. intake의 첫 턴이 끝날 때까지 사람 역할을 한다(첫 실행 창 수락, 질문에는 첫 선택지)
      await turnEnds(h.relay, ui, term, task)
      lap('intake 첫 턴')

      // 2. 표식을 알려 준다
      await typeLine(
        h.relay,
        ui,
        term,
        `기억해 둬: 이 대화의 표식은 ${MARK} 이야. '알겠음'이라고만 답하고 다른 일은 하지 마.`,
      )
      await turnEnds(h.relay, ui, term, task, true)
      lap('표식 턴')

      // 3. [즉시 중단]: 세션을 트리째 끝낸다
      const r1 = await h.relay.interrupt(key, 't-01')
      if (!r1.ok) throw new Error(`즉시 중단 실패: ${r1.error}`)
      await settle(h, key)
      const session = (
        JSON.parse(fs.readFileSync(path.join(workDir, 'work.json'), 'utf8')) as WorkState
      ).tasks[0]?.session
      lap('즉시 중단')

      // 4. [재개]: 같은 세션 id로 --resume
      const r2 = await h.relay.resume(key, 't-01')
      if (!r2.ok) throw new Error(`재개 실패: ${r2.error}`)
      await ui.until(() => task()?.live, '다시 연 세션', STEP_TIMEOUT_MS)
      lap('재개')
      const after = (
        JSON.parse(fs.readFileSync(path.join(workDir, 'work.json'), 'utf8')) as WorkState
      ).tasks[0]?.session
      expect(after?.id).toBe(session?.id)
      expect(after?.resumed_at).toBeDefined()

      // 5. 다시 연 세션에 표식을 파일에 쓰게 한다
      const file = path.join(workDir, 'tasks', '01-intake', CHECK_FILE)
      await typeLine(
        h.relay,
        ui,
        term,
        `내가 알려 준 이 대화의 표식을 ${file} 파일에 한 줄로만 써 줘. 표식을 모르면 모름이라고 써. 다른 일은 하지 마.`,
      )
      await ui.until(
        () => fs.existsSync(file),
        '표식 파일',
        STEP_TIMEOUT_MS,
        () => ui.handleDialogs(h.relay, term),
      )
      await turnEnds(h.relay, ui, term, task, true).catch(() => undefined)
      lap('표식 묻기')
      answer = fs.readFileSync(file, 'utf8').trim()
      await h.relay.abandon(key)
      await settle(h, key)
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    } finally {
      if (workDir && fs.existsSync(workDir)) {
        fs.rmSync(dir, { recursive: true, force: true })
        fs.cpSync(workDir, path.join(dir, 'work'), { recursive: true })
      }
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, 'ui.txt'), ui.dump())
      await h.close()
      const text = summary(answer, error, timings)
      fs.writeFileSync(path.join(OUT, 'resume.md'), text)
      console.log(text)
    }
    expect(error).toBeNull()
    expect(answer).toContain(MARK)
  })
})

/** 사람 역할을 하며 턴이 끝날 때까지 기다린다. again이면 먼저 새 턴이 시작되기(작업 중)를 기다린다 */
async function turnEnds(
  relay: Relay,
  ui: ScreenUi,
  term: string,
  task: () => TaskView | undefined,
  again = false,
): Promise<void> {
  if (again) {
    await ui
      .until(
        () => task()?.status === 'working',
        '새 턴',
        60_000,
        () => ui.handleDialogs(relay, term),
      )
      .catch(() => undefined)
  }
  for (;;) {
    const t = await ui.until(
      () => {
        const v = task()
        return v && (TURN_ENDED.has(v.status) || v.status === 'asking') ? v : null
      },
      '턴 끝',
      STEP_TIMEOUT_MS,
      () => ui.handleDialogs(relay, term),
    )
    if (t.status !== 'asking') return
    // 질문에는 첫 선택지(추천)로 답한다 (8.4)
    relay.terminalWrite(term, '\r')
    await ui.until(() => task()?.status !== 'asking', '답한 뒤', 3_000).catch(() => undefined)
  }
}

/** 입력란이 뜰 때까지 기다린 뒤 한 줄을 보낸다 */
async function typeLine(relay: Relay, ui: ScreenUi, term: string, text: string): Promise<void> {
  if (!dry) {
    let quiet = { screen: '', at: Date.now() }
    await ui.until(
      () => {
        const scr = ui.screen(term)
        if (scr !== quiet.screen) quiet = { screen: scr, at: Date.now() }
        return READY_HINT.test(scr) && Date.now() - quiet.at > 1500
      },
      '입력란',
      120_000,
      () => ui.handleDialogs(relay, term),
    )
  }
  relay.terminalWrite(term, text)
  await sleep(300)
  relay.terminalWrite(term, '\r')
}

function summary(answer: string | null, error: string | null, timings: Timing[]): string {
  const env = process.env
  return [
    '# relay [실제] 재개 결과',
    '',
    `- 날짜: ${new Date().toISOString()}`,
    `- 앱 커밋: ${env['GITHUB_SHA'] ?? '(로컬)'}`,
    `- OS: ${process.platform} ${env['ImageOS'] ?? ''} ${env['ImageVersion'] ?? ''}`.trimEnd(),
    `- 모델: ${env['ANTHROPIC_MODEL'] ?? '(기본)'}, effort: ${env['CLAUDE_CODE_EFFORT_LEVEL'] ?? '(기본)'}`,
    ...(dry ? ['- 가짜 claude로 돌린 도구 확인 (dry)'] : []),
    '',
    `- 결과: ${error ? `실패 (${error})` : answer?.includes(MARK) ? '통과' : '실패'}`,
    `- 다시 연 세션이 쓴 표식: ${answer ?? '(없음)'}`,
    '',
    '| 단계 | 걸린 시간 |',
    '|---|---|',
    ...timings.map((t) => `| ${t.step} | ${Math.round(t.ms / 1000)}초 |`),
    '',
  ].join('\n')
}
