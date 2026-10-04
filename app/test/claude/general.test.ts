// [실제] 실제 claude로 작은 일반 Work가 intake → execute → verify를 지나 끝까지 간다
// (docs/implementation.md M18, I91, 8.4). 가짜 claude로는 볼 수 없는 것을 본다:
// - work-start가 머리글 없는 intent 초안에 일반의 기본 완료조건 둘과, 줄마다 확인 방법을 쓴다 (D304, D305)
// - 읽기 쉬움처럼 명령으로 확인할 수 없는 조건은 `확인: 사람`으로 둔다 (D306)
// - execute가 execution.md 네 절에 완료조건별 자체 확인을 적고 커밋한다 (D309, D310)
// - verify가 사람 확인 항목을 물어 판정하고(D311), 일반 pr.md(주요 결정)를 쓴다 (D313)
// 사람 역할: 첫 실행 창은 수락하고(I17), 질문에는 첫 선택지(추천)로 답하고, 승인 대기가 되면 승인한다. 앱 설정은
// 기본값(실행 자동)이고 자동 승인 카운트다운을 기다린다(awaitAuto).
// RELAY_REAL_CLAUDE=1이면 실제 claude, dry면 가짜 claude로 도구만 확인한다. RELAY_REAL_CASES의 general로 고른다.
// 결과는 test-results/claude/general/와 general.md에 남긴다.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { taskDirName } from '../../src/core/machine'
import { CHECK_METHOD, intentDraftBody, sectionNames, sectionText } from '../../src/core/validate'
import type { WorkState } from '../../src/shared/work'
import { drive, type DriveResult } from '../flow/driver'
import { APP, FAKE_CLAUDE, git, harness, makeRepo, register, settle } from '../flow/harness'
import { generalScenario } from '../flow/scenarios'
import { S_CASE } from './repos'
import { ScreenUi } from './screen'

const mode = process.env['RELAY_REAL_CLAUDE']
const dry = mode === 'dry'
const cases = (process.env['RELAY_REAL_CASES'] ?? '').split(/[\s,]+/).filter(Boolean)
const enabled = (mode === '1' || dry) && (cases.length === 0 || cases.includes('general'))
const OUT = path.join(APP, 'test-results', 'claude')
const TASK_TIMEOUT_MS = 25 * 60 * 1000
const NUDGE = '스킬의 절차를 계속해 주세요. 마치면 종료 절차대로 handoff를 쓰고 턴을 끝내 주세요.'

/**
 * 작은 일반 Work: slug 레포(S 요청과 같은 파일)에 README와 lint 스크립트를 더한다. 문서와 설정이라 다른 유형에 맞지
 * 않고(D303), README가 읽히는지는 명령으로 확인할 수 없다(D306). 레포의 공백 버그는 범위 밖이라 고치지 않는다
 */
const REQUEST = [
  'README.md를 새로 만들어 slugify를 쓰는 법(예시 하나)과 테스트를 돌리는 명령을 적어 주세요.',
  'package.json에는 `node --check src/slug.js`를 도는 `lint` 스크립트를 더해 주세요.',
  'README는 이 레포를 처음 보는 사람이 읽고 바로 쓸 수 있으면 됩니다.',
  '',
].join('\n')

/** 레포의 공백 버그는 범위 밖이라 그대로다 */
const KEPT = 'hello-big world'

interface Result {
  drive: DriveResult
  claudeVersion: string | null
  /** 산출물 확인. 어긋난 것만 담는다 */
  problems: string[]
  notes: string[]
}

let result: Result | null = null

async function run(): Promise<Result> {
  const ui = new ScreenUi()
  const h = await harness(
    dry
      ? { ui, claudeBin: FAKE_CLAUDE, scenario: generalScenario(), productDefaults: true }
      : { ui, claudeBin: process.env['CLAUDE_BIN'] ?? null, productDefaults: true },
  )
  const dir = path.join(OUT, 'general')
  let workDir: string | null = null
  try {
    const { repo } = makeRepo(h.root, S_CASE.repo, S_CASE.files)
    const projectId = await register(h, repo)
    const created = await h.relay.createWork(projectId, {
      request: REQUEST,
      type: 'general',
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

/** 단계마다 산출물이 설계(5.3, 5.6.11, D313)의 모양인지 본다 */
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
  let human = false
  if (draft !== null) {
    need(!intentDraftBody(draft).header, 'intent 초안에 머리글이 있음 (D236)')
    const criteria = sectionText(intentDraftBody(draft).body, '완료조건') ?? ''
    const lines = criteria.split('\n').filter((l) => l.startsWith('- [ ] '))
    need(lines.length >= 3, '완료조건이 셋보다 적음')
    need(
      lines.every((l) => CHECK_METHOD.test(l)),
      '확인 방법이 없는 완료조건 줄이 있음 (D305)',
    )
    need(
      criteria.includes('약화하거나 삭제하지 않는다'),
      '일반 기본 완료조건(약화 금지) 없음 (D304)',
    )
    need(!criteria.includes('재현 절차'), '버그 수정 완료조건(재현 절차)이 들어감')
    human = lines.some((l) => /확인\s*:\s*사람/.test(l))
    notes.push(`완료조건: ${criteria.replace(/\n/g, ' / ')}`)
    notes.push(`사람 확인 항목: ${human ? '있음' : '없음'}`)
  }
  const intent = fs.readFileSync(path.join(workDir, 'intent.md'), 'utf8')
  need(/^type: general$/m.test(intent), 'intent.md 머리글에 type: general 없음 (D303)')

  const doc = readIn('execute', 'execution.md')
  need(doc !== null, 'execution.md 없음')
  if (doc !== null) {
    const names = sectionNames(doc)
    for (const s of ['계획', '변경 요약', '완료조건별 자체 확인', '테스트 실행']) {
      need(names.includes(s), `execution.md에 ## ${s} 없음 (D310)`)
    }
  }

  const commits = git(tree, 'log', '--reverse', '--format=%H %s', `${base}..HEAD`)
    .split('\n')
    .filter(Boolean)
  notes.push(`커밋: ${commits.map((c) => c.slice(41)).join(' / ') || '없음'}`)
  need(commits.length >= 1, '커밋이 없음 (D309)')
  need(fs.existsSync(path.join(tree, 'README.md')), 'README.md 없음')
  const pkg = JSON.parse(fs.readFileSync(path.join(tree, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>
  }
  need(typeof pkg.scripts?.['lint'] === 'string', 'package.json에 lint 스크립트 없음')
  need(git(tree, 'status', '--porcelain') === '', '커밋 안 된 변경이 남음')

  // 범위 밖의 공백 버그는 그대로다
  const out = execFileSync(
    'node',
    [
      '-e',
      "import('./src/slug.js').then((m) => process.stdout.write(m.slugify('Hello Big World')))",
    ],
    { cwd: tree, encoding: 'utf8' },
  )
  need(out === KEPT, `범위 밖 동작이 바뀜: slugify('Hello Big World') = ${JSON.stringify(out)}`)

  const pr = readIn('verify', 'pr.md')
  need(pr !== null, 'pr.md 없음')
  if (pr !== null) {
    const names = sectionNames(pr)
    need(names.includes('주요 결정'), 'pr.md에 ## 주요 결정 없음 (D313)')
    notes.push(`pr.md 절: ${names.join(', ')}`)
  }
  const verification = readIn('verify', 'verification.md')
  if (verification !== null) {
    const verdicts = sectionText(verification, '완료조건 판정') ?? ''
    // 사람 확인 항목은 사람에게 물어 판정하고 근거에 적는다 (D311)
    if (human)
      need(verdicts.includes('사람 확인'), '사람 확인 항목의 근거에 "사람 확인"이 없음 (D311)')
    notes.push(`판정: ${verdicts.replace(/\n/g, ' / ')}`)
  }
  return { problems, notes }
}

const seconds = (ms: number) => `${Math.round(ms / 1000)}초`

function summary(r: Result): string {
  const env = process.env
  return [
    '# relay [실제] 일반 (M18)',
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

describe.runIf(enabled)('[실제] 실제 claude로 일반 (M18, 8.4)', () => {
  afterAll(() => {
    if (!result) return
    fs.mkdirSync(OUT, { recursive: true })
    const text = summary(result)
    fs.writeFileSync(path.join(OUT, 'general.md'), text)
    console.log(text)
  })

  it('작은 일반 Work가 intake → execute → verify → Work 완료로 간다', async () => {
    result = await run()
    expect(result.drive.reason).toBeNull()
    expect(result.drive.status).toBe('completed')
    expect(result.drive.tasks.map((t) => t.label)).toEqual([
      '01 의도 정리',
      '02 실행',
      '03 리뷰와 검증',
    ])
    expect(result.drive.tasks.filter((t) => t.forced)).toEqual([])
    expect(result.problems).toEqual([])
  })
})
