// [실제] 실제 claude로 같은 레포의 Work 둘이 지식을 잇는다 (docs/implementation.md M17, I83, 8.4).
// 가짜 claude로는 볼 수 없는 것을 본다:
// - 단계 스킬이 형식 오류 없이 handoff v2의 지식 후보를 쓴다 (D295, D299)
// - Work 1에서 사람이 답한 규칙이 [완료만] 뒤 앱 저장소(공유 대기)에 쓰이고, Work 2의 intake `context.md`의
//   `참고 지식`에 들어간다 (D287, D311). intake가 그 규칙을 지식 id와 함께 intent에 옮기는지는 가능할 때라 적기만 한다
// 사람 역할: 첫 실행 창은 수락하고(I17), 질문에는 첫 선택지(추천)로 답하고, 승인 대기가 되면 승인한다. verify는
// 거르기를 기본 선택 그대로 두고 [완료만]으로 끝낸다(전달 없음). 두 Work 모두 버그 수정이다.
// RELAY_REAL_CLAUDE=1이면 실제 claude, dry면 가짜 claude로 도구만 확인한다. RELAY_REAL_CASES의 knowledge로 고른다.
// 사용량이 커서 비운 RELAY_REAL_CASES(전부)에는 들지 않는다 (I83). 결과는 test-results/claude/knowledge/와 knowledge.md에 남긴다.
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { taskDirName } from '../../src/core/machine'
import { checkHandoff, handoffV2, sectionText } from '../../src/core/validate'
import type { KnowledgeCandidateField } from '../../src/shared/contracts'
import { defaultCandidateChoice } from '../../src/shared/knowledge'
import type { WorkState } from '../../src/shared/work'
import { drive, type DriveResult, type TaskOutcome } from '../flow/driver'
import {
  APP,
  FAKE_CLAUDE,
  harness,
  makeRepo,
  register,
  settle,
  type Harness,
} from '../flow/harness'
import { handoff, scenario, steps, verifyApplied, type Scenario } from '../flow/scenarios'
import { ScreenUi } from './screen'

const mode = process.env['RELAY_REAL_CLAUDE']
const dry = mode === 'dry'
const cases = (process.env['RELAY_REAL_CASES'] ?? '').split(/[\s,]+/).filter(Boolean)
const enabled = (mode === '1' || dry) && cases.includes('knowledge')
const OUT = path.join(APP, 'test-results', 'claude')
const TASK_TIMEOUT_MS = 25 * 60 * 1000
const NUDGE = '스킬의 절차를 계속해 주세요. 마치면 종료 절차대로 handoff를 쓰고 턴을 끝내 주세요.'

const packageJson = `${JSON.stringify({ name: 'stats', private: true, type: 'module', scripts: { test: 'node --test' } }, null, 2)}\n`

/** 대시보드 통계. 빈 배열의 평균과 중앙값이 NaN·undefined다. 무엇을 돌려야 하는지는 사람만 안다 */
const FILES: Record<string, string> = {
  'package.json': packageJson,
  'src/stats.js': [
    '// 대시보드의 응답 시간 통계 (밀리초)',
    'export function average(values) {',
    '  return values.reduce((a, b) => a + b, 0) / values.length',
    '}',
    '',
    'export function median(values) {',
    '  const s = [...values].sort((a, b) => a - b)',
    '  const m = Math.floor(s.length / 2)',
    '  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2',
    '}',
    '',
  ].join('\n'),
  'test/stats.test.js': [
    "import { test } from 'node:test'",
    "import assert from 'node:assert'",
    "import { average, median } from '../src/stats.js'",
    '',
    "test('평균', () => assert.strictEqual(average([1, 2, 3]), 2))",
    "test('중앙값', () => assert.strictEqual(median([3, 1, 2]), 2))",
    '',
  ].join('\n'),
}

/** Work 1: 기대 동작을 적지 않는다. intake가 사람에게 물어야 한다 */
const REQUEST_1 = [
  '대시보드에서 요청이 없던 날의 평균 응답 시간이 NaN으로 보인다.',
  '',
  '재현: node -e "import(\'./src/stats.js\').then((m) => console.log(m.average([])))" → NaN',
  '',
  '빈 날을 어떻게 보일지는 정해진 적이 없다 (src/stats.js의 average).',
  '',
].join('\n')

/** Work 2: 같은 영역의 다음 요청. Work 1에서 정한 규칙을 다시 물을 필요가 없어야 한다 */
const REQUEST_2 = [
  '같은 대시보드에서 요청이 없던 날의 응답 시간 중앙값도 이상하게 나온다.',
  '',
  '재현: node -e "import(\'./src/stats.js\').then((m) => console.log(m.median([])))" → NaN',
  '',
  '(src/stats.js의 median)',
  '',
].join('\n')

/** dry: intake가 사람 결정과 다듬은 도메인 규칙 후보를 남긴다 (flow/knowledge.test.ts의 WORK1과 같은 꼴) */
const RULE = '요청이 없던 날의 응답 시간 통계는 0으로 보인다'
const DOMAIN: KnowledgeCandidateField = {
  kind: 'domain',
  rule: RULE,
  paths: ['src/stats.js'],
  terms: ['빈 배열', '응답 시간'],
  why: '사람이 답함: 대시보드에 NaN 대신 0을 보인다',
  not_in_code: '사람이 정함',
  incentive: '빈 배열에서 예외를 던지게 바꾼다',
  decision: RULE,
}

function dryScenario(): Scenario {
  return scenario({
    'work-start': steps('intake').map((st) =>
      st.do === 'write' && st.file === 'handoff.md'
        ? {
            ...st,
            text: handoff({
              decisions: [{ what: RULE, why: '사람이 질문에 답함', by: 'human' }],
              knowledge_candidates: [DOMAIN],
            }),
          }
        : st,
    ),
    verify: verifyApplied(),
  })
}

interface Candidate {
  task: string
  kind: string
  rule: string
  decision: boolean
}

interface WorkResult {
  drive: DriveResult
  /** 승인된 task의 handoff가 적은 v2 지식 후보 */
  candidates: Candidate[]
  /** v1으로 검사된 task (있으면 안 됨) */
  v1: string[]
  /** 사람 결정 (by: human)의 what */
  decisions: string[]
  /** intake context.md의 `참고 지식` 절. 절이 없으면 null */
  knowledge: string | null
  /** intent.md에 적힌 지식 id */
  intentIds: string[]
  /** Work 완료 화면의 지식 칸 (거르기 전) */
  screen: string[]
  /** 같은 사람 결정에서 채택이 기본인 후보가 둘 이상인 결정 (G49, D324) */
  duplicates: string[]
  claudeVersion: string | null
}

interface Result {
  works: WorkResult[]
  claudeVersion: string | null
  /** Work 1 뒤 앱 저장소에 쓰인 항목 파일 (scope/kind/id.md) */
  stored: string[]
  problems: string[]
  notes: string[]
}

let result: Result | null = null

const ID = /\b(?:domain|recipe|failure|constraint|decision|structure)-[0-9a-z]{8}\b/g

function storeFiles(store: string): string[] {
  const out: string[] = []
  for (const scope of ['pending', 'mine']) {
    const dir = path.join(store, scope)
    if (!fs.existsSync(dir)) continue
    for (const f of fs.readdirSync(dir, { recursive: true }).map(String)) {
      if (f.endsWith('.md')) out.push(`${scope}/${f.replace(/\\/g, '/')}`)
    }
  }
  return out.sort()
}

/** 멈춘 drive와 이어 간 drive의 task 기록을 합친다. 뒤 drive는 앞에서 끝난 task도 0으로 센다 */
function mergeTasks(a: TaskOutcome[], b: TaskOutcome[]): TaskOutcome[] {
  const out = new Map<string, TaskOutcome>()
  for (const t of [...a, ...b]) {
    const before = out.get(t.taskId)
    out.set(
      t.taskId,
      before
        ? {
            ...before,
            bounces: before.bounces + t.bounces,
            forced: before.forced || t.forced,
            auto: before.auto || t.auto,
            answers: before.answers + t.answers,
            nudges: before.nudges + t.nudges,
            ms: before.ms + t.ms,
          }
        : t,
    )
  }
  return [...out.values()].sort((x, y) => x.label.localeCompare(y.label))
}

async function runWork(
  h: Harness,
  ui: ScreenUi,
  projectId: string,
  request: string,
  name: string,
): Promise<WorkResult> {
  const created = await h.relay.createWork(projectId, {
    request,
    type: 'bugfix',
    baseBranch: 'main',
    baseLocation: 'local',
  })
  if (!created.ok) throw new Error(`Work 생성 실패: ${created.error}`)
  const key = created.workKey
  const workDir = path.join(h.home, 'projects', projectId, 'works', key.split('/')[1] ?? '')
  const tick = async (task: { status: string; terminal: string }) => {
    if (task.status !== 'asking') await ui.handleDialogs(h.relay, task.terminal)
  }
  const common = {
    force: true,
    nudge: NUDGE,
    maxNudges: 2,
    stepTimeoutMs: TASK_TIMEOUT_MS,
    tick,
  }
  // verify의 승인 대기에서 멈춰 Work 완료 화면의 지식 칸을 읽고, 기본 선택 그대로 [완료만]을 누른다
  const first = await drive(h.relay, ui, key, {
    ...common,
    pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
  })
  const screen: string[] = []
  const adopted = new Map<string, number>()
  let drove = first
  if (first.status === 'paused') {
    await settle(h, key)
    const verify = ui.works.get(key)?.current ?? ''
    const review = await h.relay.review(key, verify)
    for (const c of review?.completion?.knowledge?.candidates ?? []) {
      const by = c.unrefined ? ' (다듬지 않은 사람 결정)' : c.decision ? ' (사람 결정)' : ''
      const same = c.sameDecisionAs
        ? `, 같은 결정의 후보(앞: ${c.sameDecisionAs})`
        : c.similarTo
          ? `, 비슷한 후보(앞: ${c.similarTo})`
          : ''
      const adopt = defaultCandidateChoice(c, true).adopt
      screen.push(
        `${c.key} ${c.kind ?? '종류 없음'}: ${c.rule}${by} [${adopt ? '채택' : '채택 안 함'}${same}]`,
      )
      if (adopt && c.decision) adopted.set(c.decision, (adopted.get(c.decision) ?? 0) + 1)
    }
    const rest = await drive(h.relay, ui, key, common)
    drove = {
      status: rest.status,
      reason: rest.reason,
      tasks: mergeTasks(first.tasks, rest.tasks),
      ms: first.ms + rest.ms,
    }
  }
  await settle(h, key)
  const work = JSON.parse(fs.readFileSync(path.join(workDir, 'work.json'), 'utf8')) as WorkState
  const out: WorkResult = {
    drive: drove,
    candidates: [],
    v1: [],
    decisions: [],
    knowledge: null,
    intentIds: [],
    screen,
    duplicates: [...adopted].filter(([, n]) => n > 1).map(([d]) => d),
    claudeVersion: work.tasks[0]?.claude_version ?? null,
  }
  for (const t of work.tasks) {
    const dir = path.join(workDir, 'tasks', taskDirName(t))
    if (t.node === 'intake') {
      const ctx = path.join(dir, 'context.md')
      if (fs.existsSync(ctx)) out.knowledge = sectionText(fs.readFileSync(ctx, 'utf8'), '참고 지식')
    }
    const file = path.join(dir, 'handoff.md')
    if (t.status !== 'approved' || !fs.existsSync(file)) continue
    const check = checkHandoff(fs.readFileSync(file, 'utf8'), {
      node: t.node,
      type: work.type ?? 'bugfix',
      warnChars: 100_000,
      formatVersion: t.format_version,
    })
    if (check.version !== 2) out.v1.push(t.id)
    const v2 = handoffV2(check.header, check.version)
    for (const c of v2?.knowledge_candidates ?? []) {
      out.candidates.push({ task: t.id, kind: c.kind, rule: c.rule, decision: !!c.decision })
    }
    for (const d of v2?.decisions ?? []) if (d.by === 'human') out.decisions.push(d.what)
  }
  const intent = path.join(workDir, 'intent.md')
  if (fs.existsSync(intent)) {
    out.intentIds = [...new Set(fs.readFileSync(intent, 'utf8').match(ID) ?? [])]
  }
  const dir = path.join(OUT, 'knowledge', name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.cpSync(workDir, dir, { recursive: true })
  return out
}

async function run(): Promise<Result> {
  const ui = new ScreenUi()
  const h = await harness(
    dry
      ? { ui, claudeBin: FAKE_CLAUDE, scenario: dryScenario() }
      : { ui, claudeBin: process.env['CLAUDE_BIN'] ?? null },
  )
  const dir = path.join(OUT, 'knowledge')
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const problems: string[] = []
  const notes: string[] = []
  const works: WorkResult[] = []
  try {
    const { repo } = makeRepo(h.root, 'stats', FILES)
    const projectId = await register(h, repo)
    const store = path.join(h.home, 'projects', projectId, 'knowledge')

    const w1 = await runWork(h, ui, projectId, REQUEST_1, 'work-1')
    works.push(w1)
    const stored = storeFiles(store)
    if (w1.duplicates.length) {
      problems.push(
        `같은 사람 결정의 후보가 둘 이상 채택이 기본 (G49, D324): ${w1.duplicates.join(' / ')}`,
      )
    }
    if (w1.drive.status !== 'completed') {
      problems.push(`Work 1이 끝나지 않음: ${w1.drive.status} ${w1.drive.reason ?? ''}`)
      return { works, claudeVersion: works[0]?.claudeVersion ?? null, stored, problems, notes }
    }
    const w2 = await runWork(h, ui, projectId, REQUEST_2, 'work-2')
    works.push(w2)
    const ids = new Set(stored.map((f) => path.basename(f, '.md')))
    if (w2.knowledge === null) problems.push('Work 2 intake에 `참고 지식` 절 없음 (D286)')
    else if (ids.size > 0 && ![...ids].some((id) => w2.knowledge?.includes(id))) {
      problems.push('Work 1이 쓴 항목이 Work 2 intake의 `참고 지식`에 없음 (D311)')
    }
    const carried = w2.intentIds.filter((id) => ids.has(id))
    notes.push(
      carried.length
        ? `Work 2 intent에 옮긴 지식 id: ${carried.join(', ')}`
        : 'Work 2 intent에 지식 id 없음 (가능할 때라 실패로 보지 않음)',
    )
    return { works, claudeVersion: works[0]?.claudeVersion ?? null, stored, problems, notes }
  } finally {
    fs.writeFileSync(path.join(dir, 'ui.txt'), ui.dump())
    await h.close()
  }
}

const seconds = (ms: number) => `${Math.round(ms / 1000)}초`

function workLines(w: WorkResult, i: number): string[] {
  return [
    `## Work ${i + 1}`,
    '',
    `- 결과: ${w.drive.status}${w.drive.reason ? ` (${w.drive.reason})` : ''}, ${seconds(w.drive.ms)}`,
    '',
    '| task | 형식 오류 되돌림 | 오류 무시하고 승인 | 질문 답 | 재촉 | 걸린 시간 |',
    '|---|---|---|---|---|---|',
    ...w.drive.tasks.map(
      (t) =>
        `| ${t.label} | ${t.bounces} | ${t.forced ? '씀' : '0'} | ${t.answers} | ${t.nudges} | ${seconds(t.ms)} |`,
    ),
    '',
    `- 사람 결정: ${w.decisions.length ? w.decisions.join(' / ') : '없음'}`,
    `- 지식 후보 (v2): ${w.candidates.length ? w.candidates.map((c) => `${c.task} ${c.kind}${c.decision ? '(결정)' : ''}: ${c.rule}`).join(' / ') : '없음'}`,
    ...(w.v1.length ? [`- v1으로 검사된 task: ${w.v1.join(', ')}`] : []),
    `- Work 완료 화면의 지식 칸: ${w.screen.length ? w.screen.join(' / ') : '없음'}`,
    `- intake의 \`참고 지식\`: ${w.knowledge === null ? '절 없음' : w.knowledge.replace(/\n/g, ' / ')}`,
    `- intent의 지식 id: ${w.intentIds.join(', ') || '없음'}`,
    '',
  ]
}

function summary(r: Result): string {
  const env = process.env
  return [
    '# relay [실제] 지식 관리 (M17)',
    '',
    `- 날짜: ${new Date().toISOString()}`,
    `- Claude Code 버전: ${r.claudeVersion ?? '알 수 없음'}`,
    `- 모델: ${env['ANTHROPIC_MODEL'] ?? '(기본)'}, effort: ${env['CLAUDE_CODE_EFFORT_LEVEL'] ?? '(기본)'}`,
    ...(dry ? ['- 가짜 claude로 돌린 도구 확인 (dry)'] : []),
    `- Work 1 뒤 앱 저장소: ${r.stored.join(', ') || '없음'}`,
    `- 확인: ${r.problems.length ? r.problems.join('; ') : '통과'}`,
    ...r.notes.map((n) => `- ${n}`),
    '',
    ...r.works.flatMap(workLines),
  ].join('\n')
}

describe.runIf(enabled)('[실제] 실제 claude로 지식 관리 (M17, I83)', () => {
  afterAll(() => {
    if (!result) return
    fs.mkdirSync(OUT, { recursive: true })
    const text = summary(result)
    fs.writeFileSync(path.join(OUT, 'knowledge.md'), text)
    console.log(text)
  })

  it('Work 1이 쓴 지식 후보가 [완료만] 뒤 Work 2의 intake에 들어간다', async () => {
    result = await run()
    const [w1, w2] = result.works
    expect(w1?.drive.reason ?? null).toBeNull()
    expect(w1?.drive.status).toBe('completed')
    expect(w2?.drive.status).toBe('completed')
    for (const w of result.works) {
      expect(w.drive.tasks.filter((t) => t.forced)).toEqual([])
      expect(w.v1).toEqual([])
    }
    // 형식 오류 없이 v2 후보를 쓴다
    expect(w1?.drive.tasks.reduce((n, t) => n + t.bounces, 0)).toBe(0)
    expect(w1?.candidates.length).toBeGreaterThan(0)
    expect(result.stored.length).toBeGreaterThan(0)
    expect(result.problems).toEqual([])
  })
})
