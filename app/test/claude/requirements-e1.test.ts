// [실제] 실제 claude로 레거시 펌웨어 모양의 요구사항 추출 Work가 intake부터 Work 완료까지 간다
// (requirements-extraction-flow.md AI 결정 129, 8.4). 레포는 평가 시나리오 e1-twoboard의 repo/(두 보드 구성의 온도 조절기
// 펌웨어, make)이고 정답 파일은 쓰지 않는다. 작은 [실제] requirements 경우가 못 보는 것을 본다:
// - survey 뒤 앱이 빌드 명령을 보이고 묻는 결정(사람 역할은 "허용")과 별도 체크아웃의 빌드 인덱스, survey의 config_active
// - 앱이 만드는 integrate(관점별 범위)·review·summarize run이 실제 claude로 돌고 extraction.md의 개요·관점별 범위가 생긴다
// - run 상한 40 안에서 끝나거나, 닿으면 부분 분석으로 넘겨 summarize 하나로 끝낸다(사람 역할)
// - verify 승인 대기에서 결과를 저장소로 내보내 그 폴더만 커밋한다
// 사람 역할: 첫 실행 창은 수락하고(I17), 질문에는 첫 선택지(추천)로 답하고, 승인 대기가 되면 승인한다. extract가 사람
// 결정 필요로 멈추면 첫 보기(빌드 인덱스는 "허용", 보기가 없으면 "판단할 근거가 없음, 지금 코드 동작대로")로 답하고 [재개]한다.
// RELAY_REAL_CLAUDE=1이면 실제 claude, dry면 가짜 claude로 도구만 확인한다. RELAY_REAL_CASES의 requirements-e1로 고른다.
// 결과는 test-results/claude/requirements-e1/과 requirements-e1.md에 남긴다.
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { loadChecklist, loadPerspectives } from '../../../skills/extract/load.mjs'
import { taskDirName } from '../../src/core/machine'
import { currentCoverage, fold } from '../../src/core/requirements'
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
import { ScreenUi } from './screen'

const mode = process.env['RELAY_REAL_CLAUDE']
const dry = mode === 'dry'
const cases = (process.env['RELAY_REAL_CASES'] ?? '').split(/[\s,]+/).filter(Boolean)
const enabled = (mode === '1' || dry) && cases.includes('requirements-e1')
const ROOT = path.resolve(APP, '..')
const OUT = path.join(APP, 'test-results', 'claude')
const E1 = path.join(APP, 'eval', 'extract', 'scenarios', 'e1-twoboard', 'repo')
/** run 상한 (AI 결정 129) */
const RUN_LIMIT = 40
/** 사람이 할 일을 기다리는 최대 시간. extract 전체(run 여럿)를 기다린다 */
const EXTRACT_TIMEOUT_MS = 4 * 60 * 60 * 1000
const NUDGE = '스킬의 절차를 계속해 주세요. 마치면 종료 절차대로 handoff를 쓰고 턴을 끝내 주세요.'
const NO_BASIS = '판단할 근거가 없음, 지금 코드 동작대로'

const REQUEST = [
  '이 온도 조절기 펌웨어가 지금 하는 동작을 요구사항 후보와 제약으로 정리해 주세요.',
  '보드 구성(alpha, beta) 모두를 보고, 코드는 고치지 말고 확인된 것과 확인되지 않은 것을 나눠 주세요.',
  '데이터시트와 회로도는 없습니다. 빌드는 make alpha / make beta이고 돌려도 됩니다.',
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
  denied: string
}

interface Result {
  drive: DriveResult[]
  claudeVersion: string | null
  answers: { decision: string; question: string; answer: string }[]
  /** verify의 되돌림으로 extract에 되감은 추가 지시 (결정 120) */
  rewinds: string[]
  /** 상한에 닿아 부분 분석으로 넘겼는가 */
  partial: boolean
  exported: string | null
  runs: RunRecord[]
  problems: string[]
  notes: string[]
}

let result: Result | null = null

/** 레포 폴더의 파일을 { 상대 경로: 내용 }으로 */
function readTree(
  dir: string,
  base = dir,
  out: Record<string, string> = {},
): Record<string, string> {
  for (const n of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, n)
    if (fs.statSync(p).isDirectory()) readTree(p, base, out)
    else out[path.relative(base, p).split(path.sep).join('/')] = fs.readFileSync(p, 'utf8')
  }
  return out
}

/** 가짜 claude의 run 계획 (dry): survey, trace, 그리고 끝(integrate, review, summarize) */
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
  const planDir = fs.mkdtempSync(path.join(APP, 'test-results', 'req-e1-plan-'))
  const budget = { run_limit: RUN_LIMIT }
  const h = await harness(
    dry
      ? {
          ui,
          claudeBin: FAKE_CLAUDE,
          scenario: scenario(),
          productDefaults: true,
          requirementsBudget: budget,
          env: { FAKE_CLAUDE_RUN: dryPlan(planDir) },
        }
      : {
          ui,
          claudeBin: process.env['CLAUDE_BIN'] ?? null,
          productDefaults: true,
          requirementsBudget: budget,
        },
  )
  const dir = path.join(OUT, 'requirements-e1')
  let workDir: string | null = null
  const answers: Result['answers'] = []
  const rewinds: string[] = []
  let partial = false
  let exported: string | null = null
  try {
    const { repo } = dry
      ? makeRepo(h.root, 'sample', REPO_FILES)
      : makeRepo(h.root, 'thermostat', readTree(E1))
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
    for (let round = 0; round < 12; round++) {
      const drove = await drive(h.relay, ui, key, {
        force: true,
        nudge: NUDGE,
        maxNudges: 2,
        awaitAuto: true,
        stepTimeoutMs: EXTRACT_TIMEOUT_MS,
        pauseAt: (t) =>
          (t.node === 'extract' && t.status === 'interrupted') ||
          (exported === null && t.node === 'verify' && t.status === 'awaiting_approval'),
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
        // 다시 연 extract의 결과를 다음 verify 승인 대기에서 다시 내보낸다
        exported = null
        continue
      }
      if (drove.status !== 'paused') break
      await settle(h, key)
      const view = ui.works.get(key)
      const current = view?.tasks.find((t) => t.id === view.current)
      // verify 승인 대기: 결과를 저장소로 내보내고 이어서 승인한다 (AI 결정 119)
      if (current?.node === 'verify') {
        const r = await h.relay.exportRequirements(key, '')
        exported = r.ok ? `docs/requirements/${workId}` : `실패: ${r.error}`
        continue
      }
      const req = view?.requirements
      if (!view || !req?.halt) break
      if (req.halt.reason === 'run_limit') {
        // 상한: 부분 분석으로 넘겨 summarize 하나로 끝낸다 (결정 26, AI 결정 114)
        partial = true
        const r = await h.relay.partialRequirements(key)
        if (!r.ok) throw new Error(`부분 분석으로 넘기지 못함: ${r.error}`)
      } else if (req.halt.reason === 'decisions') {
        const sent = req.decisions
          .filter((d) => d.pending === null)
          .map((d) => {
            const answer = d.options[0] ?? NO_BASIS
            answers.push({ decision: d.id, question: d.question, answer })
            return { decision: d.id, answer }
          })
        const r = await h.relay.answerRequirements(key, sent)
        if (!r.ok) throw new Error(`답하지 못함: ${r.error}`)
      } else break
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
      partial,
      exported,
      ...inspect(work, workDir, tree, base, exported),
    }
  } finally {
    if (workDir && fs.existsSync(workDir)) {
      fs.rmSync(dir, { recursive: true, force: true })
      fs.cpSync(workDir, path.join(dir, 'work'), {
        recursive: true,
        // 빌드 인덱스의 체크아웃은 레포 사본이라 남기지 않는다
        filter: (src) => !src.includes(`${path.sep}build-index${path.sep}src`),
      })
    }
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'ui.txt'), ui.dump())
    fs.rmSync(planDir, { recursive: true, force: true })
    await h.close()
  }
}

/** run 기록과 산출물이 결정 107~119, 129의 모양인지 본다 */
function inspect(
  work: WorkState,
  workDir: string,
  tree: string,
  base: string,
  exported: string | null,
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
            .map((p) => p.split(':')[0] ?? '')
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
  const ok = (kind: string) => runs.some((r) => r.kind === kind && r.failure === null)
  need(runs[0]?.kind === 'survey', '첫 run이 survey가 아님')
  need(ok('trace'), '성공한 trace run이 없음')
  need(ok('integrate'), '성공한 integrate run이 없음')
  need(ok('summarize'), '성공한 summarize run이 없음')
  const byKind = runs.reduce<Record<string, number>>(
    (m, r) => ({ ...m, [r.kind]: (m[r.kind] ?? 0) + 1 }),
    {},
  )
  notes.push(`run ${runs.length}: ${JSON.stringify(byKind)}`)

  const p = work.requirements
  need(!!p, 'work.json에 requirements 포인터 없음')
  if (p) {
    need(p.run === undefined, '끝났는데 도는 run이 남음')
    need(p.halt === undefined, `끝났는데 멈춤이 남음 (${p.halt?.reason ?? ''})`)
    // 부분 분석의 summarize 하나는 상한 밖이다 (AI 결정 114)
    need(p.runs_used <= RUN_LIMIT + 1, `run 상한을 넘음 (${p.runs_used})`)
    notes.push(
      `revision ${p.revision}, run ${p.runs_used}/${RUN_LIMIT}, 연속 실패 ${p.failures_in_row}`,
    )
  }
  const revDir = path.join(req, 'revisions')
  const revs = fs.existsSync(revDir)
    ? fs
        .readdirSync(revDir)
        .sort()
        .map((f) => readJson<RequirementsRevision>(path.join(revDir, f)))
    : []
  const state = fold(revs)
  const statusCount = state.units.reduce<Record<string, number>>(
    (m, u) => ({ ...m, [u.status]: (m[u.status] ?? 0) + 1 }),
    {},
  )
  notes.push(`단위 ${state.units.length}: ${JSON.stringify(statusCount)}`)
  need(!state.units.some((u) => u.status === 'open'), '열린 단위가 남음')
  const sections = state.claims.reduce<Record<string, number>>(
    (m, c) => ({ ...m, [c.section]: (m[c.section] ?? 0) + 1 }),
    {},
  )
  notes.push(`주장 ${state.claims.length}: ${JSON.stringify(sections)}`)
  notes.push(
    `연결 ${state.links.length}, 검토 ${state.reviews.length}(내림 ${state.reviews.filter((r) => r.status).length}), 근거 ${state.evidence.length}`,
  )
  need(currentCoverage(state) !== null, '관점별 범위(coverage)가 없음')
  need((state.summary?.overview.length ?? 0) > 0, 'summarize 개요가 없음')
  const bi = state.build_index
  notes.push(
    `빌드 인덱스: ${bi ? `${bi.status}${bi.configs.length ? ` (${bi.configs.join(', ')})` : ''}${bi.detail ? `, ${bi.detail}` : ''}` : '없음'}`,
  )
  // 실제 e1은 make 구성이라 빌드 인덱스를 묻고(허용) 상태를 남긴다
  if (!dry) need(bi !== null, '빌드 인덱스 상태가 없음(make 구성인데 묻지 않음)')

  const extract = work.tasks.findLast((t) => t.node === 'extract' && t.status === 'approved')
  need(!!extract, '승인된 extract가 없음')
  if (extract) {
    const doc = path.join(workDir, 'tasks', taskDirName(extract), 'extraction.md')
    need(fs.existsSync(doc), 'extraction.md 없음')
    if (fs.existsSync(doc)) {
      const text = fs.readFileSync(doc, 'utf8')
      const names = sectionNames(text)
      notes.push(`extraction.md 절: ${names.join(', ')}`)
      need(names.includes('개요'), 'extraction.md에 개요 절이 없음')
      need(names.includes('관점별 범위'), 'extraction.md에 관점별 범위 절이 없음')
    }
  }
  // 분석은 레포를 바꾸지 않고, 내보내기만 그 폴더를 커밋한다 (결정 39, AI 결정 119)
  need(exported?.startsWith('docs/requirements/') === true, `내보내지 못함 (${exported ?? '없음'})`)
  if (exported?.startsWith('docs/requirements/')) {
    const changed = git(tree, 'diff', '--name-only', base, 'HEAD').split('\n').filter(Boolean)
    need(
      changed.length > 0 && changed.every((f) => f.startsWith(`${exported}/`)),
      `내보내기 밖의 변경: ${changed.filter((f) => !f.startsWith(`${exported}/`)).join(', ')}`,
    )
    need(fs.existsSync(path.join(tree, exported, 'record.json')), 'record.json 없음')
  }
  const verify = work.tasks.findLast((t) => t.node === 'verify' && t.status === 'approved')
  need(!!verify, '승인된 verify가 없음')
  return { runs, problems, notes }
}

const seconds = (ms: number) => `${Math.round(ms / 1000)}초`

function summary(r: Result): string {
  const last = r.drive.at(-1)
  return [
    '# relay [실제] 요구사항 추출 e1 (AI 결정 129)',
    '',
    `- 날짜: ${new Date().toISOString()}`,
    `- Claude Code 버전: ${r.claudeVersion ?? '알 수 없음'}`,
    `- 세션 모델: ${process.env['ANTHROPIC_MODEL'] ?? '(기본)'}, run: sonnet/medium (앱 기본), run 상한 ${RUN_LIMIT}`,
    ...(dry ? ['- 가짜 claude로 돌린 도구 확인 (dry)'] : []),
    `- 결과: ${last?.status ?? '없음'}${last?.reason ? ` (${last.reason})` : ''}, ${seconds(r.drive.reduce((s, d) => s + d.ms, 0))}`,
    `- 부분 분석으로 넘김: ${r.partial ? '예' : '아니오'}, 내보내기: ${r.exported ?? '안 함'}`,
    '',
    '| task | 형식 오류 되돌림 | 오류 무시하고 승인 | 질문 답 | 재촉 | 걸린 시간 |',
    '|---|---|---|---|---|---|',
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
    `- 사람 결정 필요에 대신 한 답: ${r.answers.length ? r.answers.map((a) => `${a.decision} "${a.question.split('\n')[0] ?? ''}" → ${a.answer}`).join('; ') : '없음'}`,
    `- 산출물 확인: ${r.problems.length ? r.problems.join('; ') : '통과'}`,
    ...r.notes.map((n) => `- ${n}`),
    '',
  ].join('\n')
}

describe.runIf(enabled)(
  '[실제] 실제 claude로 레거시 펌웨어 요구사항 추출 (AI 결정 129, 8.4)',
  () => {
    afterAll(() => {
      if (!result) return
      fs.mkdirSync(OUT, { recursive: true })
      const text = summary(result)
      fs.writeFileSync(path.join(OUT, 'requirements-e1.md'), text)
      console.log(text)
    })

    it('두 보드 펌웨어의 요구사항 추출 Work가 intake → extract(integrate·review·summarize 포함) → 내보내기 → verify → Work 완료로 간다', async () => {
      result = await run()
      const last = result.drive.at(-1)
      expect(last?.reason ?? null).toBeNull()
      expect(last?.status).toBe('completed')
      expect(result.drive.flatMap((d) => d.tasks).filter((t) => t.forced)).toEqual([])
      expect(result.problems).toEqual([])
    })
  },
)
