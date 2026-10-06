// [실제] 실제 claude로 설계 유형 (docs/implementation.md M20, I110, 8.4). 가짜 claude로는 볼 수 없는 것을 본다:
// - spec: 작은 설계 Work 하나가 intake → spec → verify → Work 완료로 간다. work-start가 대상 문서를 `제약`에 적고(D351)
//   "정한다" 완료조건과 기본 항목 셋을 쓰며(D354, D355), spec이 주제 목록을 물은 뒤 주제마다 질문 묶음을 내고(D357)
//   대상 문서만 커밋하며 코드 파일은 바꾸지 않고(D350), spec.md에 주제 목록이 있다. verify는 설계 pr.md를 쓴다 (D364)
// - spec-follow: 설계 문서가 있는 레포에서 요청에 그 경로를 적은 기능 추가 Work의 intake만 돌려, intent `제약`에 경로가
//   "의 결정을 따른다"로 옮겨졌는지 본다 (D369, D373)
// 사람 역할: 첫 실행 창은 수락하고(I17), 질문에는 첫 선택지(추천)로 답하고, 승인 대기가 되면 승인한다. 앱 설정은 기본값(설계
// 문답 자동)이고 자동 승인 카운트다운을 기다린다(awaitAuto).
// RELAY_REAL_CLAUDE=1이면 실제 claude, dry면 가짜 claude로 도구만 확인한다. RELAY_REAL_CASES의 spec, spec-follow로 고른다.
// 결과는 test-results/claude/spec/, spec-follow/와 spec.md에 남긴다.
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { taskDirName } from '../../src/core/machine'
import { CHECK_METHOD, intentDraftBody, sectionNames, sectionText } from '../../src/core/validate'
import type { WorkType, WorkState } from '../../src/shared/work'
import { drive, type DriveResult } from '../support/driver'
import { APP, FAKE_CLAUDE, git, harness, makeRepo, register, settle } from '../support/harness'
import { handoff, specScenario, type Scenario } from '../support/scenarios'
import { S_CASE } from './repos'
import { ScreenUi } from './screen'

const mode = process.env['RELAY_REAL_CLAUDE']
const dry = mode === 'dry'
const cases = (process.env['RELAY_REAL_CASES'] ?? '').split(/[\s,]+/).filter(Boolean)
const runs = (name: string) => (mode === '1' || dry) && (cases.length === 0 || cases.includes(name))
const OUT = path.join(APP, 'test-results', 'claude')
const TASK_TIMEOUT_MS = 25 * 60 * 1000
const NUDGE = '스킬의 절차를 계속해 주세요. 마치면 종료 절차대로 handoff를 쓰고 턴을 끝내 주세요.'

/** 작은 설계 Work: slug의 규칙을 정해 새 설계 문서에 남긴다. 코드는 바꾸지 않는다 */
const SPEC_REQUEST = [
  'slugify가 앞으로 지킬 규칙을 구현 전에 설계로 정해서 docs/design/slug-rules.md에 새 문서로 남겨 주세요.',
  '정할 것: 여러 칸 공백과 구분자를 어떻게 다룰지, 영문이 아닌 글자(한글 등)를 어떻게 다룰지.',
  '코드는 아직 바꾸지 마세요.',
  '',
].join('\n')

/** 구현 Work가 따를 설계 문서 (spec-follow) */
const FOLLOW_DOC = 'docs/design/slug-rules.md'
const FOLLOW_FILES: Record<string, string> = {
  ...S_CASE.files,
  [FOLLOW_DOC]: [
    '# slug 규칙',
    '',
    '## 개요',
    'slugify의 규칙을 정한다.',
    '',
    '## 결정',
    '| # | 결정 | 이유 | 사람 결정 |',
    '|---|---|---|---|',
    '| 1 | 연속한 공백은 하이픈 하나로 바꾼다 | URL에 빈 조각이 생기지 않게 | 사람 |',
    '| 2 | 한글은 그대로 둔다 | 한국어 제목이 많다 | 사람 |',
    '',
    '## 정하지 않은 것',
    '- 없음',
    '',
    '## 구현 나눔',
    '1. 공백 규칙(결정 1)',
    '2. 한글 규칙(결정 2)',
    '',
    '## 변경 이력',
    '- 처음 씀',
    '',
  ].join('\n'),
}
const FOLLOW_REQUEST = [`${FOLLOW_DOC}의 구현 나눔 1번(공백 규칙)을 구현해 주세요.`, ''].join('\n')

interface Result {
  name: string
  drive: DriveResult
  claudeVersion: string | null
  /** 산출물 확인. 어긋난 것만 담는다 */
  problems: string[]
  notes: string[]
}

const results: Result[] = []

/** 가짜 claude의 spec-follow intake (dry): 요청의 설계 문서를 제약에 옮긴 초안 */
function dryFollow(): Scenario {
  const draft = [
    '## 목표\n공백 규칙을 구현한다.\n',
    '## 비목표\n- 한글 규칙\n',
    '## 원하는 결과\n연속한 공백이 하이픈 하나가 된다.\n',
    '## 완료조건\n- [ ] `npm test`가 통과한다\n- [ ] 기존 테스트를 약화하거나 삭제하지 않는다\n- [ ] 완료조건의 각 동작을 확인하는 테스트가 있다\n',
    `## 제약\n- \`${FOLLOW_DOC}\`의 결정을 따른다\n`,
  ].join('\n')
  return {
    tasks: {
      'work-start': [
        { do: 'prompt' },
        { do: 'write', file: 'intent.draft.md', text: draft },
        { do: 'write', file: 'handoff.md', text: handoff({ summary: '의도 초안을 썼다.' }) },
        { do: 'stop' },
      ],
    },
  }
}

async function run(
  name: 'spec' | 'spec-follow',
  o: { type: WorkType; request: string; files: Record<string, string>; scenario: Scenario },
): Promise<Result> {
  const ui = new ScreenUi()
  const h = await harness(
    dry
      ? { ui, claudeBin: FAKE_CLAUDE, scenario: o.scenario, productDefaults: true }
      : { ui, claudeBin: process.env['CLAUDE_BIN'] ?? null, productDefaults: true },
  )
  const dir = path.join(OUT, name)
  let workDir: string | null = null
  try {
    const { repo } = makeRepo(h.root, S_CASE.repo, o.files)
    const projectId = await register(h, repo)
    const created = await h.relay.createWork(projectId, {
      request: o.request,
      type: o.type,
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
      // spec-follow는 intake만 돌린다 (I110)
      ...(name === 'spec-follow'
        ? { pauseAt: (t) => t.node === 'intake' && t.status === 'awaiting_approval' }
        : {}),
      tick: async (task) => {
        if (task.status !== 'asking') await ui.handleDialogs(h.relay, task.terminal)
      },
    })
    await settle(h, created.workKey)
    const work = JSON.parse(fs.readFileSync(path.join(workDir, 'work.json'), 'utf8')) as WorkState
    return {
      name,
      drive: drove,
      claudeVersion: work.tasks[0]?.claude_version ?? null,
      ...(name === 'spec' ? inspectSpec(work, workDir, tree, base) : inspectFollow(work, workDir)),
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

function reader(work: WorkState, workDir: string) {
  return (node: string, name: string, any = false) => {
    const t = work.tasks.findLast((x) => x.node === node && (any || x.status === 'approved'))
    const file = t ? path.join(workDir, 'tasks', taskDirName(t), name) : ''
    return t && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
  }
}

/** 설계 Work의 산출물이 설계(5.3, 5.6.12, D364)의 모양인지 본다 */
function inspectSpec(
  work: WorkState,
  workDir: string,
  tree: string,
  base: string,
): Pick<Result, 'problems' | 'notes'> {
  const problems: string[] = []
  const notes: string[] = []
  const readIn = reader(work, workDir)
  const need = (ok: boolean, what: string) => {
    if (!ok) problems.push(what)
  }

  const draft = readIn('intake', 'intent.draft.md')
  need(draft !== null, 'intent.draft.md 없음')
  let target: string | null = null
  if (draft !== null) {
    const body = intentDraftBody(draft).body
    need(!intentDraftBody(draft).header, 'intent 초안에 머리글이 있음 (D236)')
    const criteria = sectionText(body, '완료조건') ?? ''
    const lines = criteria.split('\n').filter((l) => l.startsWith('- [ ] '))
    need(
      criteria.includes('대상 문서와 지식 파일 밖의 파일을 바꾸지 않는다'),
      '기본 항목 1 없음 (D355)',
    )
    need(criteria.includes('지금 코드와 어긋나지 않는다'), '기본 항목 2 없음 (D355)')
    need(criteria.includes('정하지 않고 남긴 것은'), '기본 항목 3 없음 (D355)')
    need(
      lines.some((l) => /을 정한다|를 정한다/.test(l)),
      '"정한다" 항목 없음 (D354)',
    )
    need(!lines.some((l) => CHECK_METHOD.test(l)), '확인 방법이 붙은 줄이 있음 (D356)')
    need(!criteria.includes('재현 절차'), '버그 수정 완료조건(재현 절차)이 들어감')
    const constraint = sectionText(body, '제약') ?? ''
    target = /설계 문서:\s*`?([^`\s(]+)`?/.exec(constraint)?.[1] ?? null
    need(target !== null, '제약에 대상 문서(설계 문서: <경로>) 없음 (D351)')
    notes.push(`완료조건: ${criteria.replace(/\n/g, ' / ')}`)
    notes.push(`제약: ${constraint.replace(/\n/g, ' / ')}`)
  }
  const intent = fs.readFileSync(path.join(workDir, 'intent.md'), 'utf8')
  need(/^type: spec$/m.test(intent), 'intent.md 머리글에 type: spec 없음 (D353)')

  const spec = readIn('spec', 'spec.md')
  need(spec !== null, 'spec.md 없음')
  if (spec !== null) {
    const names = sectionNames(spec)
    for (const s of ['주제 목록', '문답 기록', '확인한 것', '문서 변경'])
      need(names.includes(s), `spec.md에 ## ${s} 없음 (5.6.12)`)
    notes.push(`주제 목록: ${(sectionText(spec, '주제 목록') ?? '').replace(/\n/g, ' / ')}`)
  }

  // 대상 문서만 커밋하고 코드는 바꾸지 않는다 (D350, D355). 지식 파일은 verify가 커밋할 수 있다 (D361)
  const changed = git(tree, 'diff', '--name-only', base, 'HEAD').split('\n').filter(Boolean)
  notes.push(`바뀐 파일: ${changed.join(', ') || '없음'}`)
  if (target) need(changed.includes(target), `대상 문서(${target})가 커밋되지 않음`)
  const outside = changed.filter((f) => f !== target && !f.startsWith('docs/knowledge/'))
  need(outside.length === 0, `대상 문서와 지식 밖의 파일을 바꿈: ${outside.join(', ')}`)
  need(git(tree, 'status', '--porcelain') === '', '커밋 안 된 변경이 남음')

  const pr = readIn('verify', 'pr.md')
  need(pr !== null, 'pr.md 없음')
  if (pr !== null) {
    const names = sectionNames(pr)
    for (const s of ['주요 결정', '다시 볼 결정', '정하지 않은 것'])
      need(names.includes(s), `pr.md에 ## ${s} 없음 (D364)`)
    notes.push(`pr.md 절: ${names.join(', ')}`)
  }
  const verification = readIn('verify', 'verification.md')
  if (verification !== null) {
    const names = sectionNames(verification)
    need(names.includes('문서 밖 파일 변경'), 'verification.md에 ## 문서 밖 파일 변경 없음 (D374)')
    need(names.includes('다시 볼 결정'), 'verification.md에 ## 다시 볼 결정 없음 (D374)')
    notes.push(
      `다시 볼 결정: ${(sectionText(verification, '다시 볼 결정') ?? '').replace(/\n/g, ' / ')}`,
    )
  }
  return { problems, notes }
}

/** 설계 문서를 따르는 요청: intake가 경로를 제약에 옮겼는지 본다 (D369) */
function inspectFollow(work: WorkState, workDir: string): Pick<Result, 'problems' | 'notes'> {
  const problems: string[] = []
  const notes: string[] = []
  const draft = reader(work, workDir)('intake', 'intent.draft.md', true)
  if (draft === null) return { problems: ['intent.draft.md 없음'], notes }
  const constraint = sectionText(intentDraftBody(draft).body, '제약') ?? ''
  notes.push(`제약: ${constraint.replace(/\n/g, ' / ')}`)
  if (!constraint.includes(FOLLOW_DOC)) problems.push(`제약에 ${FOLLOW_DOC} 없음 (D369)`)
  if (!/결정을 따른다/.test(constraint)) problems.push('제약에 "결정을 따른다" 없음 (D369)')
  return { problems, notes }
}

const seconds = (ms: number) => `${Math.round(ms / 1000)}초`

function summary(rs: Result[]): string {
  const env = process.env
  return [
    '# relay [실제] 설계 (M20)',
    '',
    `- 날짜: ${new Date().toISOString()}`,
    `- Claude Code 버전: ${rs[0]?.claudeVersion ?? '알 수 없음'}`,
    `- 모델: ${env['ANTHROPIC_MODEL'] ?? '(기본)'}, effort: ${env['CLAUDE_CODE_EFFORT_LEVEL'] ?? '(기본)'}`,
    ...(dry ? ['- 가짜 claude로 돌린 도구 확인 (dry)'] : []),
    ...rs.flatMap((r) => [
      '',
      `## ${r.name}`,
      '',
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
    ]),
    '',
  ].join('\n')
}

describe.runIf(runs('spec') || runs('spec-follow'))('[실제] 실제 claude로 설계 (M20, 8.4)', () => {
  afterAll(() => {
    if (!results.length) return
    fs.mkdirSync(OUT, { recursive: true })
    const text = summary(results)
    fs.writeFileSync(path.join(OUT, 'spec.md'), text)
    console.log(text)
  })

  it.runIf(runs('spec'))('작은 설계 Work가 intake → spec → verify → Work 완료로 간다', async () => {
    const r = await run('spec', {
      type: 'spec',
      request: SPEC_REQUEST,
      files: S_CASE.files,
      scenario: specScenario(),
    })
    results.push(r)
    expect(r.drive.reason).toBeNull()
    expect(r.drive.status).toBe('completed')
    expect(r.drive.tasks.map((t) => t.label)).toEqual([
      '01 의도 정리',
      '02 설계 문답',
      '03 리뷰와 검증',
    ])
    expect(r.drive.tasks.filter((t) => t.forced)).toEqual([])
    expect(r.problems).toEqual([])
  })

  it.runIf(runs('spec-follow'))(
    '설계 문서를 가리키는 기능 추가 요청의 intake가 경로를 제약에 옮긴다 (D369)',
    async () => {
      const r = await run('spec-follow', {
        type: 'feature',
        request: FOLLOW_REQUEST,
        files: FOLLOW_FILES,
        scenario: dryFollow(),
      })
      results.push(r)
      expect(r.drive.status).toBe('paused')
      expect(r.drive.tasks.filter((t) => t.forced)).toEqual([])
      expect(r.problems).toEqual([])
    },
  )
})
