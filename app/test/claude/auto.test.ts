// [실제] 실제 claude로 자동 승인 (docs/implementation.md M7, 8.4). 가짜 claude로는 볼 수 없는 것을 본다:
// - 실제 Stop 본문의 background_tasks와 session_crons가 턴이 끝날 때 비어 있어 카운트다운이 시작된다 (D129)
// - 실제 수정 스킬이 수동 승인과 자동 승인을 함께 적은 마무리 안내 문구를 그대로 찍는다 (D132)
// - 카운트다운 뒤 자동 승인하고 세션을 끝내 다음 단계(리뷰와 검증, M8)로 간다. 승인 방식이 work.json, task.approved,
//   decisions.md의 머리 줄에 자동으로 남는다 (4.3, 5.4, 5.5)
// S 요청 레포에서 원인 분석과 수정의 자동 승인을 켠다(카운트다운 5초). 사람 역할은 의도 정리, 리뷰와 검증을 승인하고,
// 수정은 카운트다운을 기다린다(awaitAuto). 카운트다운하지 않았거나 멈췄으면 사람처럼 승인하고, 알림에 온 까닭을
// 결과에 남긴 뒤 실패로 친다.
// RELAY_REAL_CLAUDE=1이면 실제 claude, dry면 가짜 claude로 도구만 확인한다. RELAY_REAL_CASES의 auto로 고른다.
// 결과는 test-results/claude/auto.md에 남긴다.
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { closingMessage } from '../../src/core/context'
import { taskDirName } from '../../src/core/machine'
import type { AppConfig } from '../../src/shared/config'
import type { LifecycleEvent, WorkState } from '../../src/shared/work'
import { drive, type TaskOutcome } from '../flow/driver'
import { APP, FAKE_CLAUDE, harness, makeRepo, register, settle } from '../flow/harness'
import { scenario, steps } from '../flow/scenarios'
import { S_CASE } from './repos'
import { ScreenUi } from './screen'

const mode = process.env['RELAY_REAL_CLAUDE']
const dry = mode === 'dry'
const cases = (process.env['RELAY_REAL_CASES'] ?? '').split(/[\s,]+/).filter(Boolean)
const enabled = (mode === '1' || dry) && (cases.length === 0 || cases.includes('auto'))
const OUT = path.join(APP, 'test-results', 'claude')
const TASK_TIMEOUT_MS = 25 * 60 * 1000
const NUDGE = '스킬의 절차를 계속해 주세요. 마치면 종료 절차대로 handoff를 쓰고 턴을 끝내 주세요.'
/** 수정 단계만 켠다. 카운트다운은 사람 역할이 기다릴 만큼 짧게 둔다 */
const CONFIG: Partial<AppConfig> = {
  auto_approve: { fix: true, respond: false },
  auto_approve_countdown_sec: 5,
}

interface Result {
  ok: boolean
  error: string | null
  tasks: TaskOutcome[]
  ms: number
  claudeVersion: string | null
  notes: string[]
}

let result: Result | null = null

/** 가짜 claude의 시나리오 (dry): 기본 경로. 수정은 실제 스킬처럼 턴을 끝내기 전에 마무리 안내 문구를 찍는다 */
const DRY = scenario({
  fix: [...steps('fix').slice(0, -1), { do: 'print', text: closingMessage('fix') }, { do: 'stop' }],
})

/** 공백을 모두 뺀다. 터미널은 긴 문장을 줄을 바꿔 들여 쓰므로 공백 없이 비교한다 */
const squash = (s: string) => s.replace(/\s+/g, '')
const yes = (b: boolean) => (b ? '예' : '아니오')

async function run(): Promise<Result> {
  const ui = new ScreenUi()
  const h = await harness(
    dry
      ? { ui, claudeBin: FAKE_CLAUDE, scenario: DRY, config: CONFIG }
      : { ui, claudeBin: process.env['CLAUDE_BIN'] ?? null, config: CONFIG },
  )
  const started = Date.now()
  const dir = path.join(OUT, 'auto')
  const notes: string[] = []
  let tasks: TaskOutcome[] = []
  let workDir: string | null = null
  let claudeVersion: string | null = null
  let error: string | null = null
  let watch: NodeJS.Timeout | undefined
  let printed = false
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
    // 마무리 안내 문구(D132)는 수정 세션이 살아 있는 동안 화면에서 찾는다. claude는 대체 화면에 그려서
    // 세션이 끝나면 화면에 글자가 남지 않는다
    const closing = squash(closingMessage('fix'))
    watch = setInterval(() => {
      const t = ui.works.get(key)?.tasks.find((x) => x.node === 'fix')
      if (t?.live && squash(ui.screen(t.terminal)).includes(closing)) printed = true
    }, 500)
    const r = await drive(h.relay, ui, key, {
      force: true,
      nudge: NUDGE,
      maxNudges: 2,
      stepTimeoutMs: TASK_TIMEOUT_MS,
      awaitAuto: true,
      tick: async (task) => {
        if (task.status !== 'asking') await ui.handleDialogs(h.relay, task.terminal)
      },
    })
    clearInterval(watch)
    tasks = r.tasks
    await settle(h, key)
    const wd = workDir
    const work = JSON.parse(fs.readFileSync(path.join(wd, 'work.json'), 'utf8')) as WorkState
    claudeVersion = work.tasks[0]?.claude_version ?? null
    const fix = work.tasks.find((t) => t.node === 'fix')
    if (!fix) throw new Error(`수정 task가 없음 (${r.status}: ${r.reason ?? ''})`)

    // 카운트다운과 알림 (4.3, D81, D130)
    const views = ui.history
      .filter((w) => w.key === key)
      .flatMap((w) => w.tasks.filter((t) => t.id === fix.id))
    const countdown = views.find((t) => t.countdown !== null)?.countdown ?? null
    notes.push(
      `수정의 카운트다운: ${countdown ? `${countdown.seconds}초` : '없음'}` +
        (countdown ? ' (실제 Stop 본문의 background_tasks와 session_crons가 비어 있었다)' : ''),
    )
    const notices = ui.notices.filter((n) => n.workKey === key && n.body.includes('자동 승인'))
    notes.push(`자동 승인 알림: ${notices.map((n) => n.body).join(' / ') || '없음'}`)

    // 마무리 안내 문구 (D132)
    notes.push(
      `수정 세션이 살아 있는 동안 화면에 마무리 안내 문구가 그대로 보였다: ${yes(printed)}`,
    )
    const context = fs.readFileSync(path.join(wd, 'tasks', taskDirName(fix), 'context.md'), 'utf8')
    notes.push(
      `수정의 context.md에 자동 승인 문장과 승인 방식(자동 승인, task를 시작할 때의 설정)이 있다: ${yes(
        context.includes(closingMessage('fix')) &&
          context.includes('자동 승인 (task를 시작할 때의 설정.'),
      )}`,
    )

    // 승인 방식의 기록 (5.4, 5.5)
    const events = fs
      .readFileSync(path.join(wd, 'events.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as LifecycleEvent)
    const approvedEvent = events.find((e) => e.type === 'task.approved' && e.task_id === fix.id)
    const waited = events.filter((e) => e.type === 'task.awaiting_approval' && e.task_id === fix.id)
    const head =
      fs
        .readFileSync(path.join(wd, 'decisions.md'), 'utf8')
        .split('\n')
        .find((l) => l.startsWith(`## ${fix.id} `)) ?? ''
    notes.push(
      `승인 방식: work.json ${fix.approved_by ?? '없음'}, task.approved ${String(approvedEvent?.payload['by'] ?? '없음')}, decisions.md 머리 줄 "${head}"`,
    )
    const last = waited.at(-1)
    if (last && approvedEvent) {
      const s = Math.round((Date.parse(approvedEvent.ts) - Date.parse(last.ts)) / 1000)
      notes.push(`수정의 마지막 승인 대기부터 승인까지: ${s}초 (승인 대기 ${waited.length}번)`)
    }
    const next = work.tasks[work.tasks.indexOf(fix) + 1]
    notes.push(
      `자동 승인 뒤 다음 task: ${next ? `${next.id} ${next.node} ${next.status}` : '시작하지 않음'}`,
    )

    if (r.status !== 'completed') throw new Error(`Work 완료 전에 멈춤: ${r.reason ?? r.status}`)
    const auto =
      tasks.find((t) => t.taskId === fix.id)?.auto === true &&
      fix.approved_by === 'auto' &&
      approvedEvent?.payload['by'] === 'auto' &&
      head.includes('(자동 승인)')
    if (!auto) {
      throw new Error(
        `수정이 자동 승인되지 않음 (${notices.map((n) => n.body).join(' / ') || '알림 없음'})`,
      )
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  } finally {
    clearInterval(watch)
    if (workDir && fs.existsSync(workDir)) {
      fs.rmSync(dir, { recursive: true, force: true })
      fs.cpSync(workDir, path.join(dir, 'work'), { recursive: true })
    }
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'ui.txt'), ui.dump())
    await h.close()
  }
  return {
    ok: error === null && !tasks.some((t) => t.forced),
    error,
    tasks,
    ms: Date.now() - started,
    claudeVersion,
    notes,
  }
}

const seconds = (ms: number) => `${Math.round(ms / 1000)}초`

function summary(r: Result): string {
  const env = process.env
  return [
    '# relay [실제] 자동 승인 결과',
    '',
    `- 날짜: ${new Date().toISOString()}`,
    `- 앱 커밋: ${env['GITHUB_SHA'] ?? '(로컬)'}`,
    `- Claude Code 버전: ${r.claudeVersion ?? '알 수 없음'}`,
    `- OS: ${process.platform} ${env['ImageOS'] ?? ''} ${env['ImageVersion'] ?? ''}`.trimEnd(),
    `- 모델: ${env['ANTHROPIC_MODEL'] ?? '(기본)'}, effort: ${env['CLAUDE_CODE_EFFORT_LEVEL'] ?? '(기본)'}`,
    ...(dry ? ['- 가짜 claude로 돌린 도구 확인 (dry)'] : []),
    '',
    `## auto: ${r.ok ? '통과' : '실패'} (${seconds(r.ms)})`,
    '',
    ...(r.error ? [`- 이유: ${r.error}`, ''] : []),
    '| task | 형식 오류 되돌림 | 오류 무시하고 승인 | 자동 승인 | 질문 답 | 재촉 | 걸린 시간 |',
    '|---|---|---|---|---|---|---|',
    ...r.tasks.map(
      (t) =>
        `| ${t.label} | ${t.bounces} | ${t.forced ? '씀' : '0'} | ${t.auto ? '예' : '아니오'} | ${t.answers} | ${t.nudges} | ${seconds(t.ms)} |`,
    ),
    '',
    ...r.notes.map((n) => `- ${n}`),
    '',
  ].join('\n')
}

describe.runIf(enabled)('[실제] 실제 claude로 자동 승인 (M7)', () => {
  afterAll(() => {
    if (!result) return
    fs.mkdirSync(OUT, { recursive: true })
    const text = summary(result)
    fs.writeFileSync(path.join(OUT, 'auto.md'), text)
    console.log(text)
  })

  it('auto', async () => {
    result = await run()
    expect(result.error).toBeNull()
    // [오류 무시하고 승인]을 쓴 횟수는 0이어야 한다 (8.4)
    expect(result.tasks.filter((t) => t.forced)).toEqual([])
  })
})
