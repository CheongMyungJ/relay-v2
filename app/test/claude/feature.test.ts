// [실제] 실제 claude로 작은 기능 추가가 intake → design → implement → verify를 지나 끝까지 간다
// (docs/implementation.md M14, 8.4). 가짜 claude로는 볼 수 없는 것을 본다:
// - work-start가 머리글 없는 intent 초안에 기능 추가의 기본 완료조건 셋과 인수 조건을 쓴다 (D236, D239, D240)
// - design이 코드를 바꾸지 않고 design.md 일곱 절을 쓴다 (D243, D244)
// - implement가 테스트를 먼저 커밋하거나 implement.md에 구현 전 실패를 적는다 (D247, D250)
// - verify가 기능 추가 pr.md(동작, 주요 설계 결정)를 쓴다 (D252)
// 사람 역할: 첫 실행 창은 수락하고(I17), 질문에는 첫 선택지(추천)로 답하고, 승인 대기가 되면 승인한다. 앱 설정은
// 기본값(설계와 계획 수동, 구현 자동)이고 자동 승인 카운트다운을 기다린다(awaitAuto).
// RELAY_REAL_CLAUDE=1이면 실제 claude, dry면 가짜 claude로 도구만 확인한다. RELAY_REAL_CASES의 feature로 고른다.
// 결과는 test-results/claude/feature/와 feature.md에 남긴다.
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { taskDirName } from '../../src/core/machine'
import { intentDraftBody, sectionNames, sectionText } from '../../src/core/validate'
import type { WorkState } from '../../src/shared/work'
import { drive, type DriveResult } from '../support/driver'
import { APP, FAKE_CLAUDE, git, harness, makeRepo, register, settle } from '../support/harness'
import { featureScenario } from '../support/scenarios'
import { S_CASE } from './repos'
import { ScreenUi } from './screen'

const mode = process.env['RELAY_REAL_CLAUDE']
const dry = mode === 'dry'
const cases = (process.env['RELAY_REAL_CASES'] ?? '').split(/[\s,]+/).filter(Boolean)
const enabled = (mode === '1' || dry) && (cases.length === 0 || cases.includes('feature'))
const OUT = path.join(APP, 'test-results', 'claude')
const TASK_TIMEOUT_MS = 25 * 60 * 1000
const NUDGE = '스킬의 절차를 계속해 주세요. 마치면 종료 절차대로 handoff를 쓰고 턴을 끝내 주세요.'

/** 작은 기능: slug 레포(S 요청과 같은 파일)에 최대 길이 옵션을 더한다 */
const REQUEST = [
  'slugify(title, { maxLength })에 최대 길이 옵션을 더해 주세요.',
  '',
  '결과가 maxLength보다 길면 maxLength 글자에서 자르고, 잘린 끝에 남은 -는 뗍니다.',
  '옵션이 없으면 지금처럼 자르지 않습니다.',
  '',
].join('\n')

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
      ? { ui, claudeBin: FAKE_CLAUDE, scenario: featureScenario(), productDefaults: true }
      : { ui, claudeBin: process.env['CLAUDE_BIN'] ?? null, productDefaults: true },
  )
  const dir = path.join(OUT, 'feature')
  let workDir: string | null = null
  try {
    const { repo } = makeRepo(h.root, S_CASE.repo, S_CASE.files)
    const projectId = await register(h, repo)
    const created = await h.relay.createWork(projectId, {
      request: REQUEST,
      type: 'feature',
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

/** 단계마다 산출물이 설계(5.3, 5.6.8, 5.6.9, D252)의 모양인지 본다 */
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
    need(
      criteria.includes('완료조건의 각 동작을 확인하는 테스트가 있다'),
      '기능 추가 기본 완료조건 없음 (D239)',
    )
    need(!criteria.includes('재현 절차'), '버그 수정 완료조건(재현 절차)이 들어감')
    notes.push(`완료조건: ${criteria.replace(/\n/g, ' / ')}`)
  }
  const intent = fs.readFileSync(path.join(workDir, 'intent.md'), 'utf8')
  need(/^type: feature$/m.test(intent), 'intent.md 머리글에 type: feature 없음 (D236)')

  const design = readIn('design', 'design.md')
  need(design !== null, 'design.md 없음')
  if (design !== null) {
    const names = sectionNames(design)
    for (const s of [
      '유저 시나리오',
      '요구사항',
      '접근',
      '바뀌는 곳',
      '구현 계획',
      '테스트 계획',
      '위험',
    ]) {
      need(names.includes(s), `design.md에 ## ${s} 없음 (D244)`)
    }
  }
  const designTask = task('design')
  const implTask = task('implement')
  if (designTask?.start_commit && implTask?.start_commit) {
    need(designTask.start_commit === implTask.start_commit, 'design이 커밋함 (D243)')
  }

  const impl = readIn('implement', 'implement.md')
  need(impl !== null, 'implement.md 없음')
  if (impl !== null) {
    const names = sectionNames(impl)
    for (const s of ['변경 요약', '계획과 달라진 점', '새 동작 테스트', '테스트 실행']) {
      need(names.includes(s), `implement.md에 ## ${s} 없음 (D250)`)
    }
    notes.push(
      `새 동작 테스트: ${(sectionText(impl, '새 동작 테스트') ?? '').replace(/\n/g, ' / ')}`,
    )
  }
  const log = git(tree, 'log', '--reverse', '--format=%s', `${base}..HEAD`)
  notes.push(`커밋: ${log.split('\n').filter(Boolean).join(' / ') || '없음'}`)

  const pr = readIn('verify', 'pr.md')
  need(pr !== null, 'pr.md 없음')
  if (pr !== null) notes.push(`pr.md 절: ${sectionNames(pr).join(', ')}`)
  return { problems, notes }
}

const seconds = (ms: number) => `${Math.round(ms / 1000)}초`

function summary(r: Result): string {
  const env = process.env
  return [
    '# relay [실제] 기능 추가 (M14)',
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

describe.runIf(enabled)('[실제] 실제 claude로 기능 추가 (M14, 8.4)', () => {
  afterAll(() => {
    if (!result) return
    fs.mkdirSync(OUT, { recursive: true })
    const text = summary(result)
    fs.writeFileSync(path.join(OUT, 'feature.md'), text)
    console.log(text)
  })

  it('작은 기능이 intake → design → implement → verify → Work 완료로 간다', async () => {
    result = await run()
    expect(result.drive.reason).toBeNull()
    expect(result.drive.status).toBe('completed')
    expect(result.drive.tasks.map((t) => t.label)).toEqual([
      '01 의도 정리',
      '02 설계와 계획',
      '03 구현',
      '04 리뷰와 검증',
    ])
    expect(result.drive.tasks.filter((t) => t.forced)).toEqual([])
    expect(result.problems).toEqual([])
  })
})
