// [실제] 실제 claude로 작은 커스텀 유형 Work가 intake → 조사 → 작성(마무리, D493)을 지나 끝까지 간다
// (docs/implementation.md M30, 8.4). 가짜 claude로는 볼 수 없는 것을 본다:
// - work-start가 커스텀 Work의 intent에 일반과 같이 줄마다 확인 방법을 쓰고, 테스트 명령·약화 금지 기본 항목은 넣지 않는다
//   (D455, D503)
// - 커스텀 단계가 공통 바탕 뒤에 붙은 사람의 절차를 따른다: 조사 단계는 코드를 바꾸지 않고, 정의한 절의 산출물을 쓴다
//   (D452, D453). 작성 단계는 조사 결과대로 바꾸고 커밋한다 (D454)
// - 마지막 단계인 작성이 독립 리뷰를 요청해 받고(D494~D496) 일반 pr.md(주요 결정)를 쓴다 (D456, D500)
// 사람 역할: 첫 실행 창은 수락하고(I17), 질문에는 첫 선택지(추천)로 답하고, 승인 대기가 되면 승인한다. 조사 단계는
// 유형의 기본값으로 자동 승인하고 카운트다운을 기다린다(awaitAuto). 작성 단계는 마무리 단계라 늘 수동이다 (D498).
// RELAY_REAL_CLAUDE=1이면 실제 claude, dry면 가짜 claude로 도구만 확인한다. RELAY_REAL_CASES의 custom으로 고른다.
// 결과는 test-results/claude/custom/와 custom.md에 남긴다.
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { taskDirName } from '../../src/core/machine'
import { CHECK_METHOD, intentDraftBody, sectionNames, sectionText } from '../../src/core/validate'
import type { WorkState } from '../../src/shared/work'
import { drive, type DriveResult } from '../support/driver'
import { APP, FAKE_CLAUDE, git, harness, makeRepo, register, settle } from '../support/harness'
import {
  customSteps,
  finishingSteps,
  GENERAL_VERDICTS,
  generalAfter,
  generalScenario,
  type Scenario,
} from '../support/scenarios'
import { S_CASE } from './repos'
import { ScreenUi } from './screen'

const mode = process.env['RELAY_REAL_CLAUDE']
const dry = mode === 'dry'
const cases = (process.env['RELAY_REAL_CASES'] ?? '').split(/[\s,]+/).filter(Boolean)
const enabled = (mode === '1' || dry) && (cases.length === 0 || cases.includes('custom'))
const OUT = path.join(APP, 'test-results', 'claude')
const TASK_TIMEOUT_MS = 25 * 60 * 1000
const NUDGE =
  '이 단계의 절차를 계속해 주세요. 마치면 종료 절차대로 handoff를 쓰고 턴을 끝내 주세요.'

/** 레포의 커스텀 유형 (D450): 조사(코드를 바꾸지 않음) → 작성 */
const TYPE = {
  schema_version: 1,
  name: '문서 조사 후 작성',
  description: '먼저 코드를 읽어 문서에 적을 것을 정리하고, 그대로 문서와 설정을 쓰는 일',
  steps: [
    {
      id: 'survey',
      title: '조사',
      sections: ['적을 것', '완료조건별 자체 확인'],
      auto_approve: true,
    },
    { id: 'write', title: '작성', auto_approve: true },
  ],
}

const PROCEDURES = {
  'survey.md': [
    '이 단계는 코드를 바꾸지 않는다. 커밋도 하지 않는다.',
    '레포의 코드와 package.json을 읽고, 요청한 문서에 적을 것(쓰는 법의 예시, 테스트 명령)을 `적을 것` 절에 목록으로 정리한다.',
    '',
  ].join('\n'),
  'write.md': [
    '앞 단계 산출물(survey.md)의 `적을 것`대로 문서와 설정을 쓰고 커밋한다.',
    '`적을 것`에 없는 것은 더하지 않는다.',
    '',
  ].join('\n'),
}

/** 작은 커스텀 Work: 일반 [실제]와 같은 요청이다. 레포의 공백 버그는 범위 밖이라 고치지 않는다 */
const REQUEST = [
  'README.md를 새로 만들어 slugify를 쓰는 법(예시 하나)과 테스트를 돌리는 명령을 적어 주세요.',
  'package.json에는 `node --check src/slug.js`를 도는 `lint` 스크립트를 더해 주세요.',
  '',
].join('\n')

interface Result {
  drive: DriveResult
  claudeVersion: string | null
  problems: string[]
  notes: string[]
}

let result: Result | null = null

/**
 * 가짜 claude의 두 커스텀 단계 (dry): 조사는 커밋하지 않고, 작성은 README와 lint 스크립트를 커밋한 뒤 독립 리뷰를 요청하고
 * 리뷰를 받은 뒤 일반의 판정과 pr.md로 마무리한다 (D493)
 */
function dryScenario(): Scenario {
  const pkg = JSON.parse(S_CASE.files['package.json'] ?? '{}') as {
    scripts?: Record<string, string>
  }
  pkg.scripts = { ...pkg.scripts, lint: 'node --check src/slug.js' }
  const files = {
    'README.md': "# slug\n\n```js\nslugify('Hello') // 'hello'\n```\n\n테스트: `npm test`\n",
    'package.json': JSON.stringify(pkg, null, 2) + '\n',
  }
  const write = finishingSteps(
    customSteps('write').map((st) =>
      st.do === 'commit' ? { ...st, files, message: 'docs: README와 lint 스크립트' } : st,
    ),
    GENERAL_VERDICTS,
    generalAfter(),
  )
  return {
    tasks: {
      'work-start': generalScenario().tasks['work-start'] ?? [],
      't-02': customSteps('survey', { sections: TYPE.steps[0]?.sections ?? [], commit: false }),
      't-03': write.own,
    },
    reviewed: { 't-03': write.reviewed },
  }
}

async function run(): Promise<Result> {
  const ui = new ScreenUi()
  const h = await harness(
    dry
      ? {
          ui,
          claudeBin: FAKE_CLAUDE,
          scenario: dryScenario(),
          productDefaults: true,
        }
      : { ui, claudeBin: process.env['CLAUDE_BIN'] ?? null, productDefaults: true },
  )
  const dir = path.join(OUT, 'custom')
  let workDir: string | null = null
  try {
    const { repo } = makeRepo(h.root, S_CASE.repo, S_CASE.files)
    const typeDir = path.join(repo, '.relay', 'types', 'doc-survey')
    fs.mkdirSync(typeDir, { recursive: true })
    fs.writeFileSync(path.join(typeDir, 'type.json'), JSON.stringify(TYPE, null, 2))
    for (const [name, text] of Object.entries(PROCEDURES))
      fs.writeFileSync(path.join(typeDir, name), text)
    const projectId = await register(h, repo)
    const created = await h.relay.createWork(projectId, {
      request: REQUEST,
      type: 'custom',
      customType: 'doc-survey',
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

/** 단계마다 산출물이 설계(5.3, 5.6.13, D456)의 모양인지 본다 */
function inspect(
  work: WorkState,
  workDir: string,
  tree: string,
  base: string,
): Pick<Result, 'problems' | 'notes'> {
  const problems: string[] = []
  const notes: string[] = []
  const task = (node: string, step?: string) =>
    work.tasks.findLast(
      (t) => t.node === node && (step === undefined || t.step === step) && t.status === 'approved',
    )
  const readIn = (name: string, node: string, step?: string) => {
    const t = task(node, step)
    const file = t ? path.join(workDir, 'tasks', taskDirName(t), name) : ''
    return t && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
  }
  const need = (ok: boolean, what: string) => {
    if (!ok) problems.push(what)
  }

  const draft = readIn('intent.draft.md', 'intake')
  need(draft !== null, 'intent.draft.md 없음')
  if (draft !== null) {
    const criteria = sectionText(intentDraftBody(draft).body, '완료조건') ?? ''
    const lines = criteria.split('\n').filter((l) => l.startsWith('- [ ] '))
    need(
      lines.every((l) => CHECK_METHOD.test(l)),
      '확인 방법이 없는 완료조건 줄이 있음 (D455)',
    )
    need(
      !criteria.includes('약화하거나 삭제하지 않는다'),
      '없앤 기본 완료조건(약화 금지)이 들어감 (D503)',
    )
    need(
      !/^- \[ \] `[^`]+`가 통과한다/m.test(criteria),
      '없앤 기본 완료조건(테스트 명령)이 들어감 (D503)',
    )
    notes.push(`완료조건: ${criteria.replace(/\n/g, ' / ')}`)
  }
  const intent = fs.readFileSync(path.join(workDir, 'intent.md'), 'utf8')
  need(/^type: custom$/m.test(intent), 'intent.md 머리글에 type: custom 없음')

  const survey = readIn('survey.md', 'custom', 'survey')
  need(survey !== null, 'survey.md 없음 (D453)')
  if (survey !== null) {
    const names = sectionNames(survey)
    for (const s of TYPE.steps[0]?.sections ?? [])
      need(names.includes(s), `survey.md에 ## ${s} 없음 (D453)`)
  }
  need(readIn('write.md', 'custom', 'write') !== null, 'write.md 없음 (D453)')

  // 조사 단계는 절차대로 커밋하지 않았다 (D452)
  const surveyTask = task('custom', 'survey')
  const writeTask = task('custom', 'write')
  const commits = git(tree, 'log', '--reverse', '--format=%H %s', `${base}..HEAD`)
    .split('\n')
    .filter(Boolean)
  notes.push(`커밋: ${commits.map((c) => c.slice(41)).join(' / ') || '없음'}`)
  need(commits.length >= 1, '커밋이 없음 (D454)')
  if (surveyTask?.start_commit && writeTask?.start_commit)
    need(
      surveyTask.start_commit === writeTask.start_commit,
      '조사 단계가 커밋함 (절차: 코드를 바꾸지 않는다)',
    )
  need(fs.existsSync(path.join(tree, 'README.md')), 'README.md 없음')
  need(git(tree, 'status', '--porcelain') === '', '커밋 안 된 변경이 남음')

  need(
    Boolean(writeTask?.review?.resumed_at),
    '작성 단계가 독립 리뷰를 받아 다시 열리지 않음 (D494~D496)',
  )
  need(
    readIn('independent-review.md', 'custom', 'write') !== null,
    'independent-review.md 없음 (D495)',
  )
  const pr = readIn('pr.md', 'custom', 'write')
  need(pr !== null, 'pr.md 없음')
  if (pr !== null) {
    need(sectionNames(pr).includes('주요 결정'), 'pr.md에 ## 주요 결정 없음 (D456)')
    notes.push(`pr.md 절: ${sectionNames(pr).join(', ')}`)
  }
  return { problems, notes }
}

const seconds = (ms: number) => `${Math.round(ms / 1000)}초`

function summary(r: Result): string {
  const env = process.env
  return [
    '# relay [실제] 커스텀 유형 (M30)',
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

describe.runIf(enabled)('[실제] 실제 claude로 커스텀 유형 (M30, 8.4)', () => {
  afterAll(() => {
    if (!result) return
    fs.mkdirSync(OUT, { recursive: true })
    const text = summary(result)
    fs.writeFileSync(path.join(OUT, 'custom.md'), text)
    console.log(text)
  })

  it('작은 커스텀 Work가 intake → 조사 → 작성(마무리) → Work 완료로 간다', async () => {
    result = await run()
    expect(result.drive.reason).toBeNull()
    expect(result.drive.status).toBe('completed')
    expect(result.drive.tasks.map((t) => t.label)).toEqual(['01 의도 정리', '02 조사', '03 작성'])
    expect(result.drive.tasks.filter((t) => t.forced)).toEqual([])
    expect(result.problems).toEqual([])
  })
})
