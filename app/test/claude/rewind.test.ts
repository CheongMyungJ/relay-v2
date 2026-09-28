// [실제] 실제 claude로 되감기 (docs/implementation.md M4, 8.4). 가짜 claude로는 스킬이 context.md의
// 되감기 절(사람 추가 지시, 폐기된 시도 요약)을 따르는지 볼 수 없어 둔다(사용자 결정).
// S 경로 레포에서 최종 검증이 승인 대기가 되면 사람 역할이 [단계 선택]으로 되감는다.
// - rewind-intake: 추가 지시와 함께 intake로 되감는다. intent v2가 v1을 출발점으로 고쳐지고(D40),
//   수정 커밋이 백업 브랜치에 남고, Work 완료까지 가는지 본다.
// - rewind-fix: 추가 지시와 함께 fix로 되감는다(코드 되돌림). 되감은 fix가 추가 지시를 따르고
//   Work 완료까지 가는지 본다.
// RELAY_REAL_CLAUDE=1이면 실제 claude, dry면 가짜 claude로 도구만 확인한다. RELAY_REAL_CASES로 고른다
// (rewind-intake, rewind-fix. rewind는 둘 다). 결과는 test-results/claude/rewind.md에 남긴다.
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { parseFrontMatter, sectionText } from '../../src/core/validate'
import type { WorkState } from '../../src/shared/work'
import { drive, type DriveOptions, type TaskOutcome } from '../flow/driver'
import { APP, FAKE_CLAUDE, git, harness, makeRepo, register, settle } from '../flow/harness'
import { intentDraft, scenario, steps, type Scenario } from '../flow/scenarios'
import { S_CASE } from './repos'
import { ScreenUi } from './screen'

const mode = process.env['RELAY_REAL_CLAUDE']
const dry = mode === 'dry'
const cases = (process.env['RELAY_REAL_CASES'] ?? '').split(/[\s,]+/).filter(Boolean)
const OUT = path.join(APP, 'test-results', 'claude')
const TASK_TIMEOUT_MS = 25 * 60 * 1000
const NUDGE = '스킬의 절차를 계속해 주세요. 마치면 종료 절차대로 handoff를 쓰고 턴을 끝내 주세요.'

interface RewindCase {
  name: 'rewind-intake' | 'rewind-fix'
  node: 'intake' | 'fix'
  instruction: string
  /** 가짜 claude의 시나리오 (dry). 되감은 task는 t-05다 (S 경로 intake, fix, review, verify 다음) */
  dry: Scenario
}

const EXTRA = '- [ ] 공백이 여러 개 연달아 있어도 하이픈 하나로 바꾼다'
const TEST_NAME = '여러 단어'

const CASES: RewindCase[] = [
  {
    name: 'rewind-intake',
    node: 'intake',
    instruction:
      "완료조건에 '공백이 여러 개 연달아 있어도 하이픈 하나로 바꾼다'를 더해 주세요. 나머지는 지금 intent 그대로 둡니다.",
    dry: {
      tasks: {
        ...scenario('S').tasks,
        't-05': steps('intake', 'S').map((st) =>
          st.do === 'write' && st.file === 'intent.draft.md'
            ? {
                ...st,
                text: intentDraft('S').replace(
                  '- [ ] 기존 테스트를 약화하거나 삭제하지 않는다',
                  `- [ ] 기존 테스트를 약화하거나 삭제하지 않는다\n${EXTRA}`,
                ),
              }
            : st,
        ),
      },
    },
  },
  {
    name: 'rewind-fix',
    node: 'fix',
    instruction: `앞의 수정은 버렸습니다. 다시 고치되, 재현 테스트의 이름은 '${TEST_NAME}'로 해 주세요.`,
    dry: {
      tasks: {
        ...scenario('S').tasks,
        't-05': [
          { do: 'prompt' },
          {
            do: 'commit',
            files: { 'test/slug.test.js': `// ${TEST_NAME}\n` },
            message: 'fix: 다시',
          },
          ...steps('fix', 'S').slice(2),
        ],
      },
    },
  },
]

const chosen = CASES.filter(
  (c) => cases.length === 0 || cases.includes(c.name) || cases.includes('rewind'),
)
const enabled = (mode === '1' || dry) && chosen.length > 0

interface CaseResult {
  name: string
  ok: boolean
  error: string | null
  /** 되감기 전과 뒤의 task. 되감기 뒤 task의 시간은 [확인]이 끝난 때부터 잰다 */
  tasks: TaskOutcome[]
  /** [단계 선택]의 [확인]에 걸린 시간 */
  rewindMs: number
  ms: number
  claudeVersion: string | null
  notes: string[]
  /** 되감기로 폐기된 task */
  discarded: string[]
}

const results: CaseResult[] = []

/** git 명령이 성공하는가 (종료 코드 0) */
function gitOk(cwd: string, ...args: string[]): boolean {
  try {
    git(cwd, ...args)
    return true
  } catch {
    return false
  }
}

/** intent.md의 완료조건 줄 */
function criteria(intent: string): string[] {
  const body = parseFrontMatter(intent).body
  return (sectionText(body, '완료조건') ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- [ ]'))
}

async function runCase(c: RewindCase): Promise<CaseResult> {
  const ui = new ScreenUi()
  const h = await harness(
    dry
      ? { ui, claudeBin: FAKE_CLAUDE, scenario: c.dry }
      : { ui, claudeBin: process.env['CLAUDE_BIN'] ?? null },
  )
  const started = Date.now()
  const dir = path.join(OUT, c.name)
  const notes: string[] = []
  const tasks: TaskOutcome[] = []
  const discarded: string[] = []
  let rewindMs = 0
  let workDir: string | null = null
  let claudeVersion: string | null = null
  let error: string | null = null
  try {
    const { repo } = makeRepo(h.root, S_CASE.repo, S_CASE.files)
    const base = git(repo, 'rev-parse', 'main')
    const projectId = await register(h, repo)
    const created = await h.relay.createWork(projectId, {
      request: S_CASE.request,
      baseBranch: 'main',
      baseLocation: 'local',
    })
    if (!created.ok) throw new Error(`Work 생성 실패: ${created.error}`)
    const key = created.workKey
    workDir = path.join(h.home, 'projects', projectId, 'works', key.split('/')[1] ?? '')
    const tree = path.join(h.home, 'projects', projectId, 'worktrees', key.split('/')[1] ?? '')
    const opts: DriveOptions = {
      size: 'S',
      force: true,
      nudge: NUDGE,
      maxNudges: 2,
      stepTimeoutMs: TASK_TIMEOUT_MS,
      tick: async (task) => {
        if (task.status !== 'asking') await ui.handleDialogs(h.relay, task.terminal)
      },
    }
    const load = () =>
      JSON.parse(fs.readFileSync(path.join(workDir ?? '', 'work.json'), 'utf8')) as WorkState

    // 1. 최종 검증이 승인 대기가 될 때까지
    const first = await drive(h.relay, ui, key, {
      ...opts,
      pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
    })
    tasks.push(...first.tasks)
    if (first.status !== 'paused') throw new Error(`최종 검증 전에 멈춤: ${first.reason ?? ''}`)
    await settle(h, key)
    const v1 = fs.readFileSync(path.join(workDir, 'intent.md'), 'utf8')
    const fixHead = git(tree, 'rev-parse', 'HEAD')

    // 2. [단계 선택]: 미리 보고 추가 지시와 함께 되감는다
    const p = await h.relay.stepPreview(key, c.node, false)
    if (!p.ok) throw new Error(`미리 보기 실패: ${p.error}`)
    const rewindAt = Date.now()
    const r = await h.relay.selectStep(key, {
      node: c.node,
      keepCode: false,
      instruction: c.instruction,
      expect: p.preview.expect,
    })
    if (!r.ok) throw new Error(`되감기 실패: ${r.error}`)
    rewindMs = Date.now() - rewindAt
    await settle(h, key)
    const branch = p.preview.code.backupBranch
    notes.push(
      `미리 보기: 폐기 ${p.preview.discard.map((d) => d.label).join(', ')}, 되돌릴 커밋 ${p.preview.code.commits}개, 백업 ${branch ?? '없음'}`,
    )
    // 백업 브랜치는 되돌린 커밋을 가리킨다(커밋 안 된 변경이 있었으면 그 위의 커밋 하나, D116)
    if (!branch || !gitOk(repo, 'merge-base', '--is-ancestor', fixHead, branch)) {
      throw new Error('되돌린 커밋이 백업 브랜치에 없음')
    }

    // 3. 되감은 단계부터 Work 완료까지
    const second = await drive(h.relay, ui, key, opts)
    // drive는 스냅샷의 task를 모두 세므로 되감기 전 task는 앞의 것만 남긴다
    const before = new Set(tasks.map((t) => t.taskId))
    tasks.push(...second.tasks.filter((t) => !before.has(t.taskId)))
    if (second.status !== 'completed')
      throw new Error(`되감은 뒤 끝나지 않음: ${second.reason ?? ''}`)
    await settle(h, key)
    const work = load()
    claudeVersion = work.tasks[0]?.claude_version ?? null
    discarded.push(...work.tasks.filter((t) => t.status === 'discarded').map((t) => t.id))
    const rewound = work.tasks.find((t) => t.reason === 'rewind')
    notes.push(
      `task: ${work.tasks.map((t) => `${t.id} ${t.node} ${t.status}`).join(', ')}`,
      `되감은 task의 시작 커밋이 기준 커밋이다: ${rewound?.start_commit === base ? '예' : '아니오'}`,
    )
    if (c.node === 'intake') {
      const v2 = fs.readFileSync(path.join(workDir, 'intent.md'), 'utf8')
      const before = criteria(v1)
      const after = criteria(v2)
      const kept = before.filter((l) => after.includes(l))
      notes.push(
        `intent: v${work.intent?.version ?? '?'}, 완료조건 ${before.length}개 → ${after.length}개, v1 항목 중 그대로 남은 것 ${kept.length}개`,
        `v2에 새로 든 완료조건: ${after.filter((l) => !before.includes(l)).join(' / ') || '없음'}`,
      )
      if (work.intent?.version !== 2) throw new Error('intent 버전이 2가 아님')
      if (after.length <= before.length) throw new Error('추가 지시의 완료조건이 v2에 없음')
    } else {
      const named = gitOk(tree, 'grep', '-q', '-F', TEST_NAME, 'HEAD', '--', 'test')
      notes.push(`재현 테스트 이름에 '${TEST_NAME}'가 있다: ${named ? '예' : '아니오'}`)
      if (!named) throw new Error('되감은 fix가 추가 지시를 따르지 않음')
    }
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
  }
  return {
    name: c.name,
    ok: error === null && !tasks.some((t) => t.forced),
    error,
    tasks,
    rewindMs,
    ms: Date.now() - started,
    claudeVersion,
    notes,
    discarded,
  }
}

const seconds = (ms: number) => `${Math.round(ms / 1000)}초`

function summary(): string {
  const env = process.env
  const lines = [
    '# relay [실제] 되감기 결과',
    '',
    `- 날짜: ${new Date().toISOString()}`,
    `- 앱 커밋: ${env['GITHUB_SHA'] ?? '(로컬)'}`,
    `- Claude Code 버전: ${results.find((r) => r.claudeVersion)?.claudeVersion ?? '알 수 없음'}`,
    `- OS: ${process.platform} ${env['ImageOS'] ?? ''} ${env['ImageVersion'] ?? ''}`.trimEnd(),
    `- 모델: ${env['ANTHROPIC_MODEL'] ?? '(기본)'}, effort: ${env['CLAUDE_CODE_EFFORT_LEVEL'] ?? '(기본)'}`,
    ...(dry ? ['- 가짜 claude로 돌린 도구 확인 (dry)'] : []),
    '',
  ]
  for (const r of results) {
    lines.push(
      `## ${r.name}: ${r.ok ? '통과' : '실패'} (${seconds(r.ms)}, 되감기 ${seconds(r.rewindMs)})`,
      '',
      ...(r.error ? [`- 이유: ${r.error}`, ''] : []),
      '| task | 형식 오류 되돌림 | 오류 무시하고 승인 | 질문 답 | 재촉 | 걸린 시간 |',
      '|---|---|---|---|---|---|',
      ...r.tasks.map(
        (t) =>
          `| ${t.label}${r.discarded.includes(t.taskId) ? ' (폐기)' : ''} | ${t.bounces} | ${t.forced ? '씀' : '0'} | ${t.answers} | ${t.nudges} | ${seconds(t.ms)} |`,
      ),
      '',
      ...r.notes.map((n) => `- ${n}`),
      '',
    )
  }
  return lines.join('\n')
}

describe.runIf(enabled)('[실제] 실제 claude로 되감기 (M4)', () => {
  afterAll(() => {
    fs.mkdirSync(OUT, { recursive: true })
    const text = summary()
    fs.writeFileSync(path.join(OUT, 'rewind.md'), text)
    console.log(text)
  })

  for (const c of chosen) {
    it(c.name, async () => {
      const r = await runCase(c)
      results.push(r)
      expect(r.error).toBeNull()
      // [오류 무시하고 승인]을 쓴 횟수는 0이어야 한다 (8.4)
      expect(r.tasks.filter((t) => t.forced)).toEqual([])
    })
  }
})
