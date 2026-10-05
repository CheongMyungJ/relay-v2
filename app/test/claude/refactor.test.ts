// [실제] 실제 claude로 작은 리팩터링이 intake → refactor → verify를 지나 끝까지 간다
// (docs/implementation.md M15, 8.4). 가짜 claude로는 볼 수 없는 것을 본다:
// - work-start가 머리글 없는 intent 초안에 리팩터링의 기본 완료조건 넷과 구조 조건을 쓴다 (D264, D266)
// - refactor가 안전망을 먼저 따로 커밋하고, refactor.md 다섯 절에 안전망 커밋 해시를 적는다 (D259, D272, I64)
// - 숨은 버그(공백을 하나만 바꿈)를 고치지 않고 지금 동작을 지킨다 (D260)
// - verify가 리팩터링 pr.md(목표 구조, 동작 보존, 찾은 버그)를 쓰고 작업 브랜치로 돌아와 있다 (D273, D274)
// 사람 역할: 첫 실행 창은 수락하고(I17), 질문에는 첫 선택지(추천)로 답하고, 승인 대기가 되면 승인한다. 앱 설정은
// 기본값(계획과 리팩터링 자동)이고 자동 승인 카운트다운을 기다린다(awaitAuto).
// RELAY_REAL_CLAUDE=1이면 실제 claude, dry면 가짜 claude로 도구만 확인한다. RELAY_REAL_CASES의 refactor로 고른다.
// 결과는 test-results/claude/refactor/와 refactor.md에 남긴다.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { taskDirName } from '../../src/core/machine'
import { intentDraftBody, sectionNames, sectionText } from '../../src/core/validate'
import type { WorkState } from '../../src/shared/work'
import { drive, type DriveResult } from '../support/driver'
import { APP, FAKE_CLAUDE, git, harness, makeRepo, register, settle } from '../support/harness'
import { refactorScenario, steps, type Step } from '../support/scenarios'
import { S_CASE } from './repos'
import { ScreenUi } from './screen'

const mode = process.env['RELAY_REAL_CLAUDE']
const dry = mode === 'dry'
const cases = (process.env['RELAY_REAL_CASES'] ?? '').split(/[\s,]+/).filter(Boolean)
const enabled = (mode === '1' || dry) && (cases.length === 0 || cases.includes('refactor'))
const OUT = path.join(APP, 'test-results', 'claude')
const TASK_TIMEOUT_MS = 25 * 60 * 1000
const NUDGE = '스킬의 절차를 계속해 주세요. 마치면 종료 절차대로 handoff를 쓰고 턴을 끝내 주세요.'

/**
 * 작은 리팩터링: slug 레포(S 요청과 같은 파일)의 slugify를 단계별 함수로 나눈다. 레포에는 공백을 하나만 바꾸는 버그가
 * 그대로 있고, 리팩터링은 그것을 고치지 않아야 한다 (D260)
 */
const REQUEST = [
  'src/slug.js의 slugify가 하는 일(앞뒤 공백 떼기, 소문자로, 공백을 -로)을 src/text.js의 작은 함수들로 나눠 주세요.',
  'slugify는 그 함수들을 차례로 부르기만 하면 됩니다.',
  '',
  '동작은 지금과 같아야 합니다.',
  '',
].join('\n')

/** 숨은 버그를 고치지 않았으면 지금 동작 그대로 첫 공백만 바뀐다 (D260) */
const KEPT = 'hello-big world'

interface Result {
  drive: DriveResult
  claudeVersion: string | null
  /** 산출물 확인. 어긋난 것만 담는다 */
  problems: string[]
  notes: string[]
}

let result: Result | null = null

/**
 * 가짜 claude의 리팩터링 (dry): slug 레포에서 안전망을 먼저 커밋하고, 그 커밋 id를 refactor.md에 적은 뒤 구조를
 * 바꿔 커밋한다. 동작(첫 공백만 바꿈)은 그대로다 (D259, D260, I64)
 */
function dryRefactor(): Step[] {
  const base = steps('refactor')
  const doc = base.find((st) => st.do === 'write' && st.file === 'refactor.md')
  const [prompt, ...tail] = base.filter((st) => st.do !== 'commit' && st !== doc)
  if (!prompt || !doc || doc.do !== 'write') throw new Error('refactor 단계의 모양이 바뀜')
  return [
    prompt,
    {
      do: 'commit',
      files: {
        'test/slug-safety.test.js': [
          "import { test } from 'node:test'",
          "import assert from 'node:assert'",
          "import { slugify } from '../src/slug.js'",
          '',
          "test('첫 공백만 바뀐다 (안전망)', () => assert.strictEqual(slugify(' Hello Big World '), 'hello-big world'))",
          '',
        ].join('\n'),
      },
      message: 'test: slugify 안전망',
    },
    { ...doc, text: doc.text.replace('(안전망 커밋)', '`{head}`') },
    {
      do: 'commit',
      files: {
        'src/text.js': [
          'export const trim = (s) => s.trim()',
          'export const lower = (s) => s.toLowerCase()',
          "export const dash = (s) => s.replace(' ', '-')",
          '',
        ].join('\n'),
        'src/slug.js': [
          "import { dash, lower, trim } from './text.js'",
          '',
          '// 제목을 URL 조각으로',
          'export function slugify(title) {',
          '  return dash(lower(trim(title)))',
          '}',
          '',
        ].join('\n'),
      },
      message: 'refactor: slugify를 text.js의 함수로 나눔',
    },
    ...tail,
  ]
}

async function run(): Promise<Result> {
  const ui = new ScreenUi()
  const h = await harness(
    dry
      ? {
          ui,
          claudeBin: FAKE_CLAUDE,
          scenario: refactorScenario({ refactor: dryRefactor() }),
          productDefaults: true,
        }
      : { ui, claudeBin: process.env['CLAUDE_BIN'] ?? null, productDefaults: true },
  )
  const dir = path.join(OUT, 'refactor')
  let workDir: string | null = null
  try {
    const { repo } = makeRepo(h.root, S_CASE.repo, S_CASE.files)
    const projectId = await register(h, repo)
    const created = await h.relay.createWork(projectId, {
      request: REQUEST,
      type: 'refactor',
      baseBranch: 'main',
      baseLocation: 'local',
    })
    if (!created.ok) throw new Error(`Work 생성 실패: ${created.error}`)
    const workId = created.workKey.split('/')[1] ?? ''
    workDir = path.join(h.home, 'projects', projectId, 'works', workId)
    const tree = path.join(h.home, 'projects', projectId, 'worktrees', workId)
    const base = git(tree, 'rev-parse', 'HEAD')
    const drove = await drive(h.relay, ui, created.workKey, {
      force: true,
      nudge: NUDGE,
      maxNudges: 2,
      awaitAuto: true,
      stepTimeoutMs: TASK_TIMEOUT_MS,
      tick: async (task) => {
        if (task.status !== 'asking') await ui.handleDialogs(h.relay, task.terminal)
      },
    })
    await settle(h, created.workKey)
    const work = JSON.parse(fs.readFileSync(path.join(workDir, 'work.json'), 'utf8')) as WorkState
    return {
      drive: drove,
      claudeVersion: work.tasks[0]?.claude_version ?? null,
      ...inspect(work, workDir, tree, base),
    }
  } finally {
    if (workDir && fs.existsSync(workDir)) {
      fs.rmSync(dir, { recursive: true, force: true })
      fs.cpSync(workDir, path.join(dir, 'work'), { recursive: true })
    }
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'ui.txt'), ui.dump())
    await h.close()
  }
}

/** 단계마다 산출물이 설계(5.3, 5.6.10, D274)의 모양인지 본다 */
function inspect(
  work: WorkState,
  workDir: string,
  tree: string,
  base: string,
): Pick<Result, 'problems' | 'notes'> {
  const problems: string[] = []
  const notes: string[] = []
  const task = (node: string) =>
    work.tasks.findLast((t) => t.node === node && t.status === 'approved')
  const readIn = (node: string, name: string) => {
    const t = task(node)
    const file = t ? path.join(workDir, 'tasks', taskDirName(t), name) : ''
    return t && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
  }
  const need = (ok: boolean, what: string) => {
    if (!ok) problems.push(what)
  }

  const draft = readIn('intake', 'intent.draft.md')
  need(draft !== null, 'intent.draft.md 없음')
  if (draft !== null) {
    need(!intentDraftBody(draft).header, 'intent 초안에 머리글이 있음 (D236)')
    const criteria = sectionText(intentDraftBody(draft).body, '완료조건') ?? ''
    need(criteria.includes('안전망 테스트'), '리팩터링 기본 완료조건(안전망) 없음 (D264)')
    need(
      criteria.includes('공개 인터페이스'),
      '리팩터링 기본 완료조건(공개 인터페이스) 없음 (D264)',
    )
    need(!criteria.includes('재현 절차'), '버그 수정 완료조건(재현 절차)이 들어감')
    notes.push(`완료조건: ${criteria.replace(/\n/g, ' / ')}`)
  }
  const intent = fs.readFileSync(path.join(workDir, 'intent.md'), 'utf8')
  need(/^type: refactor$/m.test(intent), 'intent.md 머리글에 type: refactor 없음 (D261)')

  const doc = readIn('refactor', 'refactor.md')
  need(doc !== null, 'refactor.md 없음')
  let safety: string | null = null
  if (doc !== null) {
    const names = sectionNames(doc)
    for (const s of [
      '계획',
      '안전망 테스트',
      '변경 요약',
      '찾은 버그와 받아들인 차이',
      '테스트 실행',
    ]) {
      need(names.includes(s), `refactor.md에 ## ${s} 없음 (D272)`)
    }
    safety = /안전망 커밋:\s*`?([0-9a-f]{7,40})/.exec(doc)?.[1] ?? null
    need(safety !== null, 'refactor.md에 안전망 커밋 해시 없음 (I64)')
    notes.push(
      `찾은 버그와 받아들인 차이: ${(sectionText(doc, '찾은 버그와 받아들인 차이') ?? '').replace(/\n/g, ' / ')}`,
    )
  }

  // 안전망이 첫 커밋이고 테스트 파일만 바꾼다 (D259)
  const commits = git(tree, 'log', '--reverse', '--format=%H %s', `${base}..HEAD`)
    .split('\n')
    .filter(Boolean)
  notes.push(`커밋: ${commits.map((c) => c.slice(41)).join(' / ') || '없음'}`)
  const first = commits[0]?.slice(0, 40)
  if (first) {
    const files = git(tree, 'show', '--name-only', '--format=', first).split('\n').filter(Boolean)
    need(
      files.length > 0 && files.every((f) => /(^|\/)test/.test(f)),
      `첫 커밋이 안전망만이 아님: ${files.join(', ')}`,
    )
    if (safety)
      need(first.startsWith(safety), `refactor.md의 안전망 커밋(${safety})이 첫 커밋이 아님`)
  }
  need(commits.length >= 2, '안전망과 구조 변경 커밋이 나뉘지 않음 (D269)')
  need(fs.existsSync(path.join(tree, 'src/text.js')), 'src/text.js 없음 (구조 목표)')

  // 숨은 버그를 고치지 않았다: 첫 공백만 바뀐다 (D260)
  const out = execFileSync(
    'node',
    [
      '-e',
      "import('./src/slug.js').then((m) => process.stdout.write(m.slugify('Hello Big World')))",
    ],
    { cwd: tree, encoding: 'utf8' },
  )
  need(out === KEPT, `동작이 바뀜: slugify('Hello Big World') = ${JSON.stringify(out)} (D260)`)

  // verify가 안전망 커밋을 체크아웃했다가 작업 브랜치로 돌아왔다 (I64)
  need(git(tree, 'branch', '--show-current') !== '', '작업 브랜치로 돌아오지 않음 (I64)')

  const pr = readIn('verify', 'pr.md')
  need(pr !== null, 'pr.md 없음')
  if (pr !== null) {
    const names = sectionNames(pr)
    need(names.includes('동작 보존'), 'pr.md에 ## 동작 보존 없음 (D274)')
    notes.push(`pr.md 절: ${names.join(', ')}`)
  }
  const verification = readIn('verify', 'verification.md')
  if (verification !== null) {
    notes.push(`판정: ${(sectionText(verification, '완료조건 판정') ?? '').replace(/\n/g, ' / ')}`)
  }
  return { problems, notes }
}

const seconds = (ms: number) => `${Math.round(ms / 1000)}초`

function summary(r: Result): string {
  const env = process.env
  return [
    '# relay [실제] 리팩터링 (M15)',
    '',
    `- 날짜: ${new Date().toISOString()}`,
    `- Claude Code 버전: ${r.claudeVersion ?? '알 수 없음'}`,
    `- 모델: ${env['ANTHROPIC_MODEL'] ?? '(기본)'}, effort: ${env['CLAUDE_CODE_EFFORT_LEVEL'] ?? '(기본)'}`,
    ...(dry ? ['- 가짜 claude로 돌린 도구 확인 (dry)'] : []),
    `- 결과: ${r.drive.status}${r.drive.reason ? ` (${r.drive.reason})` : ''}, ${seconds(r.drive.ms)}`,
    '',
    '| task | 자동 승인 | 형식 오류 되돌림 | 오류 무시하고 승인 | 질문 답 | 재촉 | 걸린 시간 |',
    '|---|---|---|---|---|---|---|',
    ...r.drive.tasks.map(
      (t) =>
        `| ${t.label} | ${t.auto ? '예' : '아니오'} | ${t.bounces} | ${t.forced ? '씀' : '0'} | ${t.answers} | ${t.nudges} | ${seconds(t.ms)} |`,
    ),
    '',
    `- 산출물 확인: ${r.problems.length ? r.problems.join('; ') : '통과'}`,
    ...r.notes.map((n) => `- ${n}`),
    '',
  ].join('\n')
}

describe.runIf(enabled)('[실제] 실제 claude로 리팩터링 (M15, 8.4)', () => {
  afterAll(() => {
    if (!result) return
    fs.mkdirSync(OUT, { recursive: true })
    const text = summary(result)
    fs.writeFileSync(path.join(OUT, 'refactor.md'), text)
    console.log(text)
  })

  it('작은 리팩터링이 intake → refactor → verify → Work 완료로 간다', async () => {
    result = await run()
    expect(result.drive.reason).toBeNull()
    expect(result.drive.status).toBe('completed')
    expect(result.drive.tasks.map((t) => t.label)).toEqual([
      '01 의도 정리',
      '02 계획과 리팩터링',
      '03 리뷰와 검증',
    ])
    expect(result.drive.tasks.filter((t) => t.forced)).toEqual([])
    expect(result.problems).toEqual([])
  })
})
