// [실제] 실제 claude로 작은 요구사항 추출 Work가 intake → extract → verify를 지나 끝까지 간다
// (requirements-extraction-flow.md 17.12, 결정 92~100, 8.4). 가짜 claude로는 볼 수 없는 것을 본다:
// - 앱이 조립한 지시·스키마·패킷으로 실제 `claude -p` run이 구조화 출력을 내고, run 판정(마지막 Stop의 두 필드 포함)과
//   반영 검사(기준 커밋의 경로·인용 대조)를 통과한다
// - survey가 낸 단위를 trace run들이 돌고, 열린 단위가 없으면 extraction.md와 handoff.md를 렌더링해 승인 대기가 된다
// - work-start와 verify의 requirements 블록으로 의도 정리와 검증이 지나간다
// 사람 역할: 첫 실행 창은 수락하고(I17), 질문에는 첫 선택지(추천)로 답하고, 승인 대기가 되면 승인한다. extract가 사람
// 결정 필요로 멈추면 첫 보기(보기가 없으면 "판단할 근거가 없음, 지금 코드 동작대로")로 답하고 [재개]한다.
// RELAY_REAL_CLAUDE=1이면 실제 claude, dry면 가짜 claude로 도구만 확인한다. RELAY_REAL_CASES의 requirements로 고른다.
// run의 모델과 effort는 앱 기본(sonnet, medium, 결정 50)이다. 결과는 test-results/claude/requirements/와
// requirements.md에 남긴다.
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { loadChecklist, loadPerspectives } from '../../../skills/extract/load.mjs'
import { taskDirName } from '../../src/core/machine'
import { fold } from '../../src/core/requirements'
import { sectionNames, sectionText } from '../../src/core/validate'
import type { RequirementsRevision } from '../../src/shared/requirements'
import type { WorkState } from '../../src/shared/work'
import { drive, type DriveResult } from '../support/driver'
import { APP, FAKE_CLAUDE, git, harness, makeRepo, register, settle } from '../support/harness'
import {
  extractIntegrate,
  extractReview,
  extractSummarize,
  extractSurvey,
  extractTrace,
} from '../support/requirements'
import { REPO_FILES, scenario } from '../support/scenarios'
import { M_CASE } from './repos'
import { ScreenUi } from './screen'

const mode = process.env['RELAY_REAL_CLAUDE']
const dry = mode === 'dry'
const cases = (process.env['RELAY_REAL_CASES'] ?? '').split(/[\s,]+/).filter(Boolean)
const enabled = (mode === '1' || dry) && (cases.length === 0 || cases.includes('requirements'))
const ROOT = path.resolve(APP, '..')
const OUT = path.join(APP, 'test-results', 'claude')
/** 사람이 할 일을 기다리는 최대 시간. extract 전체(여러 run)를 기다린다 */
const EXTRACT_TIMEOUT_MS = 90 * 60 * 1000
const NUDGE = '스킬의 절차를 계속해 주세요. 마치면 종료 절차대로 handoff를 쓰고 턴을 끝내 주세요.'
const NO_BASIS = '판단할 근거가 없음, 지금 코드 동작대로'

/** 작은 레포(리더보드, 숫자를 글자로 정렬하는 버그가 있음)의 지금 동작을 요구사항으로 정리한다. 고치지 않는다 */
const REQUEST = [
  '이 저장소의 리더보드가 지금 하는 동작을 요구사항으로 정리해 주세요.',
  '코드는 고치지 말고, 지금 코드에서 확인되는 동작과 확인되지 않는 것을 나눠 주세요.',
  '',
].join('\n')
const DRY_REQUEST = '이 저장소의 평균 계산 동작을 요구사항으로 정리해 줘\n'

interface RunRecord {
  id: string
  unit: string
  kind: string
  failure: string | null
  end: string
  denials: number
  /** 되돌린 제출의 규칙 이름과 수 (quote_match는 code와 tool_output 앵커를 함께 센다, 결정 101) */
  denied: string
}

interface Result {
  drive: DriveResult[]
  claudeVersion: string | null
  /** 사람 결정 필요에 앱이 대신 한 답 */
  answers: { decision: string; question: string; answer: string }[]
  /** verify의 되돌림으로 extract에 되감은 추가 지시 (결정 120) */
  rewinds: string[]
  runs: RunRecord[]
  problems: string[]
  notes: string[]
}

let result: Result | null = null

/** 가짜 claude의 run 계획 (dry): survey, trace, 그리고 끝(integrate, review, summarize, AI 결정 111~113) */
function dryPlan(dir: string): string {
  const plan = path.join(dir, 'plan.json')
  const runs = [
    extractSurvey(),
    extractTrace(loadChecklist('command', ROOT).map((c) => c.id)),
    extractIntegrate(loadPerspectives(ROOT).map((p) => p.id)),
    extractReview(['q1'], ['s1']),
    extractSummarize(),
  ].map((o) => ({ outputs: [o] }))
  fs.writeFileSync(plan, JSON.stringify({ runs }))
  return plan
}

const readJson = <T>(file: string) => JSON.parse(fs.readFileSync(file, 'utf8')) as T

/**
 * verify가 extract로 되돌려 Work가 멈추면 사람 역할은 한 번, verify가 고른 지적(반영하지 않은 지적)을 추가 지시로 붙여
 * [현재 기록 위에서 이어서] extract로 되감는다 (결정 120, verify 스킬의 되돌아가기). 되감았으면 그 지시를 돌려준다
 */
async function rewindToExtract(
  h: Awaited<ReturnType<typeof harness>>,
  key: string,
  workDir: string,
  reason: string | null,
): Promise<string | null> {
  if (!reason?.includes('(extract)')) return null
  const work = readJson<WorkState>(path.join(workDir, 'work.json'))
  const verify = work.tasks.findLast((t) => t.node === 'verify')
  if (!verify) return null
  const file = path.join(workDir, 'tasks', taskDirName(verify), 'verification.md')
  const picked = fs.existsSync(file)
    ? (sectionText(fs.readFileSync(file, 'utf8'), '반영하지 않은 지적') ?? '')
    : ''
  const instruction = picked.trim() || reason
  const preview = await h.relay.stepPreview(key, 'extract', true)
  if (!preview.ok) throw new Error(`되감기 미리 보기 실패: ${preview.error}`)
  const r = await h.relay.selectStep(key, {
    node: 'extract',
    keepCode: true,
    instruction,
    expect: preview.preview.expect,
  })
  if (!r.ok) throw new Error(`extract로 되감지 못함: ${r.error}`)
  return instruction
}

async function run(): Promise<Result> {
  const ui = new ScreenUi()
  fs.mkdirSync(path.join(APP, 'test-results'), { recursive: true })
  const planDir = fs.mkdtempSync(path.join(APP, 'test-results', 'req-plan-'))
  const h = await harness(
    dry
      ? {
          ui,
          claudeBin: FAKE_CLAUDE,
          scenario: scenario(),
          productDefaults: true,
          env: { FAKE_CLAUDE_RUN: dryPlan(planDir) },
        }
      : { ui, claudeBin: process.env['CLAUDE_BIN'] ?? null, productDefaults: true },
  )
  const dir = path.join(OUT, 'requirements')
  let workDir: string | null = null
  const answers: Result['answers'] = []
  const rewinds: string[] = []
  try {
    const { repo } = dry
      ? makeRepo(h.root, 'sample', REPO_FILES)
      : makeRepo(h.root, M_CASE.repo, M_CASE.files)
    const projectId = await register(h, repo)
    const created = await h.relay.createWork(projectId, {
      request: dry ? DRY_REQUEST : REQUEST,
      type: 'requirements',
      baseBranch: 'main',
      baseLocation: 'local',
    })
    if (!created.ok) throw new Error(`Work 생성 실패: ${created.error}`)
    const key = created.workKey
    const workId = key.split('/')[1] ?? ''
    workDir = path.join(h.home, 'projects', projectId, 'works', workId)
    const tree = path.join(h.home, 'projects', projectId, 'worktrees', workId)
    const base = git(tree, 'rev-parse', 'HEAD')
    const drives: DriveResult[] = []
    // extract가 사람 결정 필요로 멈추면 대신 답하고 [재개]한다. 다른 까닭으로 멈추면 실패다
    for (let round = 0; round < 6; round++) {
      const drove = await drive(h.relay, ui, key, {
        force: true,
        nudge: NUDGE,
        maxNudges: 2,
        awaitAuto: true,
        // extract는 run 여럿을 도는 동안 사람이 할 일이 없다
        stepTimeoutMs: EXTRACT_TIMEOUT_MS,
        pauseAt: (t) => t.node === 'extract' && t.status === 'interrupted',
        tick: async (task) => {
          if (task.status !== 'asking' && task.node !== 'extract')
            await ui.handleDialogs(h.relay, task.terminal)
        },
      })
      drives.push(drove)
      if (drove.status === 'stopped' && rewinds.length < 1) {
        const rewound = await rewindToExtract(h, key, workDir, drove.reason)
        if (!rewound) break
        rewinds.push(rewound)
        continue
      }
      if (drove.status !== 'paused') break
      await settle(h, key)
      const view = ui.works.get(key)
      const req = view?.requirements
      if (!view || !req?.halt || req.halt.reason !== 'decisions') break
      const sent = req.decisions
        .filter((d) => d.pending === null)
        .map((d) => {
          const answer = d.options[0] ?? NO_BASIS
          answers.push({ decision: d.id, question: d.question, answer })
          return { decision: d.id, answer }
        })
      const r = await h.relay.answerRequirements(key, sent)
      if (!r.ok) throw new Error(`답하지 못함: ${r.error}`)
      const resumed = await h.relay.resume(key, view.current ?? '')
      if (!resumed.ok) throw new Error(`재개하지 못함: ${resumed.error}`)
    }
    await settle(h, key)
    const work = readJson<WorkState>(path.join(workDir, 'work.json'))
    return {
      drive: drives,
      claudeVersion: work.tasks[0]?.claude_version ?? null,
      answers,
      rewinds,
      ...inspect(work, workDir, tree, base),
    }
  } finally {
    if (workDir && fs.existsSync(workDir)) {
      fs.rmSync(dir, { recursive: true, force: true })
      fs.cpSync(workDir, path.join(dir, 'work'), { recursive: true })
    }
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'ui.txt'), ui.dump())
    fs.rmSync(planDir, { recursive: true, force: true })
    await h.close()
  }
}

/** run 기록과 산출물이 설계(결정 93, 97, 99)의 모양인지 본다 */
function inspect(
  work: WorkState,
  workDir: string,
  tree: string,
  base: string,
): Pick<Result, 'runs' | 'problems' | 'notes'> {
  const problems: string[] = []
  const notes: string[] = []
  const need = (ok: boolean, what: string) => {
    if (!ok) problems.push(what)
  }
  const req = path.join(workDir, 'requirements')
  const runsDir = path.join(req, 'runs')
  const runs: RunRecord[] = fs.existsSync(runsDir)
    ? fs
        .readdirSync(runsDir)
        .sort()
        .flatMap((id) => {
          const file = path.join(runsDir, id, 'run.json')
          if (!fs.existsSync(file)) return []
          const r = readJson<Record<string, unknown>>(file)
          const submits = Array.isArray(r['submits'])
            ? (r['submits'] as { denied?: boolean; problems?: string[] }[])
            : []
          const rules = submits
            .filter((x) => x.denied)
            .flatMap((x) => x.problems ?? [])
            .map((p) => {
              const rule = p.split(':')[0] ?? ''
              return rule === 'quote_match' && / output /.test(p) ? 'quote_match(출력)' : rule
            })
          const count = rules.reduce<Record<string, number>>(
            (m, x) => ({ ...m, [x]: (m[x] ?? 0) + 1 }),
            {},
          )
          return [
            {
              id,
              unit: String(r['unit'] ?? ''),
              kind: String(r['kind'] ?? ''),
              failure: typeof r['failure'] === 'string' ? r['failure'] : null,
              end: String(r['end'] ?? ''),
              denials: submits.filter((x) => x.denied).length,
              denied: Object.entries(count)
                .map(([k, n]) => `${k}×${n}`)
                .join(', '),
            },
          ]
        })
    : []
  need(runs.length >= 2, `run이 둘보다 적음 (${runs.length})`)
  need(runs[0]?.kind === 'survey', '첫 run이 survey가 아님')
  need(
    runs.some((r) => r.kind === 'trace' && r.failure === null),
    '성공한 trace run이 없음',
  )

  const p = work.requirements
  need(!!p, 'work.json에 requirements 포인터 없음')
  if (p) {
    need(p.run === undefined, '끝났는데 도는 run이 남음')
    need(p.halt === undefined, `끝났는데 멈춤이 남음 (${p.halt?.reason ?? ''})`)
    notes.push(`revision ${p.revision}, run ${p.runs_used}, 연속 실패 ${p.failures_in_row}`)
  }
  // 변경분을 접어 단위와 주장 수를 센다
  const revDir = path.join(req, 'revisions')
  const revs = fs.existsSync(revDir)
    ? fs
        .readdirSync(revDir)
        .sort()
        .map((f) => readJson<RequirementsRevision>(path.join(revDir, f)))
    : []
  const state = fold(revs)
  const units = new Map(state.units.map((u) => [u.id, u.status]))
  const claims = state.claims
  const statusCount = [...units.values()].reduce<Record<string, number>>(
    (m, s) => ({ ...m, [s]: (m[s] ?? 0) + 1 }),
    {},
  )
  notes.push(`단위 ${units.size}: ${JSON.stringify(statusCount)}`)
  need(![...units.values()].includes('open'), '열린 단위가 남음')
  const sections = claims.reduce<Record<string, number>>(
    (m, c) => ({ ...m, [c.section]: (m[c.section] ?? 0) + 1 }),
    {},
  )
  notes.push(`주장 ${claims.length}: ${JSON.stringify(sections)}`)
  need(claims.length > 0, '주장이 없음')
  notes.push(`근거 ${state.evidence.length}`)

  const extract = work.tasks.findLast((t) => t.node === 'extract' && t.status === 'approved')
  need(!!extract, '승인된 extract가 없음')
  if (extract) {
    const taskDir = path.join(workDir, 'tasks', taskDirName(extract))
    const doc = path.join(taskDir, 'extraction.md')
    need(fs.existsSync(doc), 'extraction.md 없음')
    if (fs.existsSync(doc))
      notes.push(`extraction.md 절: ${sectionNames(fs.readFileSync(doc, 'utf8')).join(', ')}`)
  }
  // 분석은 레포를 바꾸지 않는다 (결정 39)
  need(git(tree, 'rev-parse', 'HEAD') === base, 'extract가 커밋을 만듦')
  const verify = work.tasks.findLast((t) => t.node === 'verify' && t.status === 'approved')
  need(!!verify, '승인된 verify가 없음')
  return { runs, problems, notes }
}

const seconds = (ms: number) => `${Math.round(ms / 1000)}초`

function summary(r: Result): string {
  const last = r.drive.at(-1)
  return [
    '# relay [실제] 요구사항 추출 (17.12)',
    '',
    `- 날짜: ${new Date().toISOString()}`,
    `- Claude Code 버전: ${r.claudeVersion ?? '알 수 없음'}`,
    `- 세션 모델: ${process.env['ANTHROPIC_MODEL'] ?? '(기본)'}, run: sonnet/medium (앱 기본)`,
    ...(dry ? ['- 가짜 claude로 돌린 도구 확인 (dry)'] : []),
    `- 결과: ${last?.status ?? '없음'}${last?.reason ? ` (${last.reason})` : ''}, ${seconds(r.drive.reduce((s, d) => s + d.ms, 0))}`,
    '',
    '| task | 형식 오류 되돌림 | 오류 무시하고 승인 | 질문 답 | 재촉 | 걸린 시간 |',
    '|---|---|---|---|---|---|',
    // [재개]로 drive를 다시 부르면 같은 task가 다시 잡힌다. task마다 마지막 것을 쓴다
    ...[...new Map(r.drive.flatMap((d) => d.tasks).map((t) => [t.taskId, t])).values()].map(
      (t) =>
        `| ${t.label} | ${t.bounces} | ${t.forced ? '씀' : '0'} | ${t.answers} | ${t.nudges} | ${seconds(t.ms)} |`,
    ),
    '',
    '| run | 단위 | 종류 | 결과 | 제출 되돌림 | 되돌린 규칙 | 실패 |',
    '|---|---|---|---|---|---|---|',
    ...r.runs.map(
      (x) =>
        `| ${x.id} | ${x.unit} | ${x.kind} | ${x.end} | ${x.denials} | ${x.denied} | ${x.failure ?? ''} |`,
    ),
    '',
    `- verify의 되돌림으로 extract에 되감음: ${r.rewinds.length ? `${r.rewinds.length}회 (지시: ${r.rewinds.map((x) => x.split('\n')[0]?.slice(0, 120) ?? '').join(' / ')})` : '없음'}`,
    `- 사람 결정 필요에 대신 한 답: ${r.answers.length ? r.answers.map((a) => `${a.decision} "${a.question}" → ${a.answer}`).join('; ') : '없음'}`,
    `- 산출물 확인: ${r.problems.length ? r.problems.join('; ') : '통과'}`,
    ...r.notes.map((n) => `- ${n}`),
    '',
  ].join('\n')
}

describe.runIf(enabled)('[실제] 실제 claude로 요구사항 추출 (17.12, 8.4)', () => {
  afterAll(() => {
    if (!result) return
    fs.mkdirSync(OUT, { recursive: true })
    const text = summary(result)
    fs.writeFileSync(path.join(OUT, 'requirements.md'), text)
    console.log(text)
  })

  it('작은 요구사항 추출 Work가 intake → extract(run 여럿) → verify → Work 완료로 간다', async () => {
    result = await run()
    const last = result.drive.at(-1)
    expect(last?.reason ?? null).toBeNull()
    expect(last?.status).toBe('completed')
    expect(result.drive.flatMap((d) => d.tasks).filter((t) => t.forced)).toEqual([])
    expect(result.problems).toEqual([])
  })
})
