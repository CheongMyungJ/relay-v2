#!/usr/bin/env node
// 결과 폴더를 모아 report.md와 report.json을 만든다. run.mjs가 끝에 부르고, 따로 다시 돌릴 수도 있다.
//   node eval/report.mjs <결과 폴더>            요약만 다시 만든다
//   node eval/report.mjs <결과 폴더> --rejudge  짝 판정을 다시 하고 요약한다
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DIMENSIONS, judgePair } from './lib/judge.mjs'
import { armBase, armType, typeLabel } from './lib/kind.mjs'
import { codeOutcome } from './lib/repo.mjs'
import { clip, readJson, readJsonl, stats, writeJson } from './lib/util.mjs'
import { measuredWorks, multiWork, pairOf, workParts } from './lib/works.mjs'

const SCENARIOS = process.env.RELAY_EVAL_SCENARIOS
  ? path.resolve(process.env.RELAY_EVAL_SCENARIOS)
  : path.resolve(import.meta.dirname, 'scenarios')

/** 쪽의 차례와 보고서의 이름. relay-off는 지식 관리를 끈 relay다. 그 밖의 이름(--app으로 준 빌드)은 이름 차례로 뒤에 둔다 */
const ARMS = ['relay', 'relay-off', 'cli']
const LABEL = { relay: 'relay', 'relay-off': 'relay (지식 끔)', cli: '맨 CLI' }
const label = (k) => {
  // relay@<유형>은 그 유형으로 만든 Work다 (교차 비교, I93)
  const type = armType(k)
  if (type) return `${label(armBase(k))} (${typeLabel(type)} 유형)`
  return LABEL[k] ?? (k.endsWith('-off') ? `${k.slice(0, -4)} (지식 끔)` : k)
}

/** 판정의 두 쪽. pair가 없는 예전 판정은 relay 대 맨 CLI다 */
const pairOfJudge = (j) => j.pair ?? ['relay', 'cli']
const scoreOf = (j, k) => j.experience.scores?.[k] ?? j.experience[`${k}Score`] ?? null

/** 결과 폴더의 실행들: <시나리오>/<쪽>-<회차>/run.json */
export function loadRuns(dir) {
  const runs = []
  for (const s of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!s.isDirectory()) continue
    for (const r of fs.readdirSync(path.join(dir, s.name), { withFileTypes: true })) {
      const file = path.join(dir, s.name, r.name, 'run.json')
      if (r.isDirectory() && fs.existsSync(file))
        runs.push({ dir: path.join(dir, s.name, r.name), ...readJson(file) })
    }
  }
  return runs
}

export function loadScenario(id) {
  const dir = path.join(SCENARIOS, id)
  return { dir, ...readJson(path.join(dir, 'scenario.json')) }
}

/** 판정이 없는 짝을 판정한다 */
export async function judgeAll(dir, opts, { redo = false } = {}) {
  const runs = loadRuns(dir)
  const out = []
  for (const id of [...new Set(runs.map((r) => r.scenario))].sort()) {
    const scenario = loadScenario(id)
    const indexes = [...new Set(runs.filter((r) => r.scenario === id).map((r) => r.index))].sort(
      (a, b) => a - b,
    )
    // 짝: --pairs(config.json의 pairs), 없으면 시나리오의 짝(relay 대 맨 CLI, works 시나리오는 relay 대 relay-off)
    for (const [a, b] of opts.pairs ?? [pairOf(scenario)])
      for (const i of indexes) {
        const first = runs.find((r) => r.scenario === id && r.kind === a && r.index === i)
        const second = runs.find((r) => r.scenario === id && r.kind === b && r.index === i)
        if (!first || !second) continue
        const isDefault = !opts.pairs || (a === pairOf(scenario)[0] && b === pairOf(scenario)[1])
        const file = path.join(dir, id, isDefault ? `judge-${i}.json` : `judge-${a}-${b}-${i}.json`)
        if (!redo && fs.existsSync(file)) {
          out.push(readJson(file))
          continue
        }
        console.log(`[판정] ${id} ${a}:${b} #${i}`)
        try {
          const j = await judgePair({
            scenario,
            first,
            second,
            firstDir: first.dir,
            secondDir: second.dir,
            opts,
            workDir: path.join(
              opts.workRoot ?? path.join(os.tmpdir(), 'relay-eval', path.basename(dir)),
              `judge-${id}-${a}-${b}-${i}`,
            ),
          })
          writeJson(file, j)
          out.push(j)
        } catch (e) {
          console.log(`[판정] ${id} ${a}:${b} #${i} 실패: ${String(e).slice(0, 300)}`)
        }
      }
  }
  return out
}

const f1 = (x) => (x === null || x === undefined ? '-' : Number(x).toFixed(1))
const f2 = (x) => (x === null || x === undefined ? '-' : Number(x).toFixed(2))
const pct = (a, n) => (n ? `${Math.round((100 * a) / n)}% (${a}/${n})` : '-')
const ms = (s) => (s.mean === null ? '-' : `${f1(s.mean)} ± ${f1(s.sd)}`)

/**
 * 사람 역할이 답하는 데 쓴 시간(밀리초)과 기다리기만 한 차례 (eval-findings E2). 예전 결과는 run.json에 없어
 * turns.jsonl의 차례 기록에서 센다
 */
function humanTime(r) {
  if (typeof r.human.ms === 'number') return { ms: r.human.ms, waitOnly: r.human.waitOnlyTurns }
  const turns = readJsonl(path.join(r.dir, 'turns.jsonl')).filter((t) => typeof t.turn === 'number')
  return {
    ms: turns.reduce((a, t) => a + (typeof t.ms === 'number' ? t.ms : 0), 0),
    waitOnly: turns.filter((t) => (t.actions ?? []).every((a) => a.do === 'wait')).length,
  }
}

function metricRows(rs) {
  const get = (fn) => stats(rs.map(fn))
  const n = rs.length
  const sv = (k) => get((r) => r.survey?.[k] ?? null)
  const time = new Map(rs.map((r) => [r, humanTime(r)]))
  return [
    ['숨긴 시험 모두 통과', pct(rs.filter((r) => r.outcome.success).length, n)],
    ['레포 시험 통과', pct(rs.filter((r) => r.outcome.repoTestsPass).length, n)],
    ['커밋까지 됨', pct(rs.filter((r) => r.outcome.committed).length, n)],
    ['사람이 끝냄(done)', pct(rs.filter((r) => r.ending === 'done').length, n)],
    ['걸린 시간(분)', ms(get((r) => r.wallMs / 60000))],
    ['사람 역할 응답 시간(분)', ms(get((r) => (time.get(r)?.ms ?? 0) / 60000))],
    ['걸린 시간 − 사람 역할 응답(분)', ms(get((r) => (r.wallMs - (time.get(r)?.ms ?? 0)) / 60000))],
    ['사람 차례 수', ms(get((r) => r.human.turns))],
    ['기다리기만 한 차례', ms(get((r) => time.get(r)?.waitOnly ?? null))],
    ['스크린샷을 붙인 차례', ms(get((r) => r.human.images ?? null))],
    ['사람 행동 수(기다림 제외)', ms(get((r) => r.human.actionsTotal))],
    ['입력한 글자 수', ms(get((r) => r.human.charsTyped))],
    ['코드 직접 확인(inspect_diff)', ms(get((r) => r.human.actions.inspect_diff ?? 0))],
    ['헛동작(없는 요소, 실패)', ms(get((r) => r.human.invalidActions))],
    ['friction 평균 (0~3)', ms(get((r) => r.human.frictionMean))],
    ['friction 2 이상 차례', ms(get((r) => r.human.frictionHigh))],
    ['설문 수고 (1~7, 낮을수록 좋음)', ms(sv('effort'))],
    ['설문 명확함', ms(sv('clarity'))],
    ['설문 통제감', ms(sv('control'))],
    ['설문 결과 확신', ms(sv('confidence'))],
    ['설문 신뢰', ms(sv('trust'))],
    ['설문 복구', ms(sv('recovery'))],
    ['설문 다시 쓰고 싶음', ms(sv('reuse'))],
    // relay의 지식 파일은 코드 결과에서 빼고 따로 센다 (lib/repo.mjs, docs/eval.md 6절)
    ['바뀐 줄 수', ms(get((r) => codeOutcome(r.outcome).linesChanged))],
    ['기대 밖 파일 수', ms(get((r) => codeOutcome(r.outcome).unrelated.length))],
    ['지식 파일 수(판정에서 뺌)', ms(get((r) => codeOutcome(r.outcome).knowledgeFiles.length))],
    ['에이전트 출력 토큰(천)', ms(get((r) => r.agent.output / 1000))],
    [
      '에이전트 입력 토큰(천, 캐시 포함)',
      ms(get((r) => (r.agent.input + r.agent.cacheRead + r.agent.cacheWrite) / 1000)),
    ],
    ['에이전트 세션 수', ms(get((r) => r.agent.sessions))],
    ['사람 역할 비용($)', ms(get((r) => r.human.costUsd))],
  ]
}

/**
 * relay의 단계별 에이전트 토큰과 context.md 크기 (eval-findings R9). 한 줄이 한 단계(node)이고 수치는 그 단계
 * task 하나의 평균이다. 단계는 평균 순번 차례로 놓는다
 */
function stepRows(rs) {
  const steps = rs.flatMap((r) => r.agentSteps ?? [])
  const seq = (node) => stats(steps.filter((s) => s.node === node).map((s) => s.seq)).mean
  const nodes = [...new Set(steps.map((s) => s.node))].sort((a, b) => seq(a) - seq(b))
  return nodes.map((node) => {
    const own = steps.filter((s) => s.node === node)
    const k = (fn) => ms(stats(own.map((s) => (s.tokens ? fn(s.tokens) / 1000 : null))))
    return [
      node,
      `${own.length}`,
      k((t) => t.input + t.cacheRead + t.cacheWrite),
      k((t) => t.cacheWrite),
      k((t) => t.output),
      ms(stats(own.map((s) => s.contextChars))),
      ms(stats(own.map((s) => s.knowledgeChars ?? null))),
    ]
  })
}

function judgeRows(js, [a, b]) {
  const n = js.length
  const row = (name, fn) => {
    const ca = js.filter((j) => fn(j) === a).length
    const cb = js.filter((j) => fn(j) === b).length
    const na = js.filter((j) => fn(j) === 'n/a').length
    return [name, `${ca}`, `${cb}`, `${n - ca - cb - na}`, `${na}`]
  }
  const rows = [row('결과(가림) 선호', (j) => j.outcome.preferred)]
  for (const d of DIMENSIONS) rows.push(row(`경험: ${d}`, (j) => j.experience[d]?.winner))
  return rows
}

function scoreRows(js, [a, b]) {
  const s = (fn) => ms(stats(js.map(fn)))
  const rows = []
  for (const k of ['correctness', 'scope', 'quality', 'tests']) {
    rows.push([`결과 ${k} (1~5)`, s((j) => j.outcome[a]?.[k]), s((j) => j.outcome[b]?.[k])])
  }
  rows.push(['경험 점수 (1~10)', s((j) => scoreOf(j, a)), s((j) => scoreOf(j, b))])
  return rows
}

/** 판정 표 둘(우세, 점수). 짝마다 따로 보인다 */
function judgeTables(js) {
  const out = []
  const keys = [...new Set(js.map((j) => pairOfJudge(j).join(',')))]
  for (const key of keys) {
    const pair = key.split(',')
    const own = js.filter((j) => pairOfJudge(j).join(',') === key)
    out.push(
      table(
        ['짝 판정', `${label(pair[0])} 우세`, `${label(pair[1])} 우세`, '비김', '해당 없음'],
        judgeRows(own, pair),
      ),
      '',
      table(['판정 점수', label(pair[0]), label(pair[1])], scoreRows(own, pair)),
      '',
    )
  }
  return out
}

/**
 * Work 둘을 잇는 시나리오의 Work 하나. 재는 것은 Work 2의 사람 차례, 질문 수(대화 기록의 AskUserQuestion),
 * 입력 토큰과 context.md 글자, 숨긴 시험이다. Work 1도 견줄 수 있게 같은 줄로 보인다
 */
function workRows(rs, n) {
  const w = (r) => r.workResults?.[n] ?? null
  const own = rs.map(w).filter(Boolean)
  const get = (fn) => ms(stats(own.map(fn)))
  return [
    ['실행 수', `${own.length}`],
    ['숨긴 시험 모두 통과', pct(own.filter((x) => x.outcome?.success).length, own.length)],
    [
      '숨긴 시험별 통과',
      [...new Set(own.flatMap((x) => (x.outcome?.checks ?? []).map((c) => c.name)))]
        .map(
          (name) =>
            `${name} ${own.filter((x) => x.outcome?.checks.find((c) => c.name === name)?.pass).length}/${own.length}`,
        )
        .join(', ') || '-',
    ],
    ['사람이 끝냄(done)', pct(own.filter((x) => x.ending === 'done').length, own.length)],
    ['새 일 전에 끝내려다 거절됨(도구, E11)', get((x) => x.human.refusedDone ?? 0)],
    ['사람 차례 수', get((x) => x.human.turns)],
    ['사람 행동 수(기다림 제외)', get((x) => x.human.actionsTotal)],
    ['입력한 글자 수', get((x) => x.human.charsTyped)],
    [
      '앞 Work의 사실을 다시 알려 줌(carry 항목 수, 감사)',
      get((x) => (x.human.carriedTotal ? (x.human.carriedToldAudit ?? null) : null)),
    ],
    [
      '앞 Work의 사실을 다시 알려 줌(사람 역할 자기 보고)',
      get((x) => (x.human.carriedTotal ? (x.human.carriedTold ?? null) : null)),
    ],
    ['에이전트 질문 수(AskUserQuestion)', get((x) => x.agent?.questions ?? null)],
    [
      '에이전트 입력 토큰(천, 캐시 포함)',
      get((x) =>
        x.agent ? (x.agent.input + x.agent.cacheRead + x.agent.cacheWrite) / 1000 : null,
      ),
    ],
    ['에이전트 출력 토큰(천)', get((x) => (x.agent ? x.agent.output / 1000 : null))],
    ['context.md 글자(Work의 task 합)', get((x) => x.contextChars ?? null)],
    ['넣은 지식 글자(Work의 task 합)', get((x) => x.knowledgeChars ?? null)],
    ['걸린 시간(분)', get((x) => x.wallMs / 60000)],
    ['friction 평균 (0~3)', get((x) => x.human.frictionMean)],
  ]
}

const table = (head, rows) =>
  [
    `| ${head.join(' | ')} |`,
    `|${head.map(() => '---').join('|')}|`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n')

export function buildReport(dir) {
  const config = readJson(path.join(dir, 'config.json'), {})
  const runs = loadRuns(dir)
  const judges = []
  for (const s of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!s.isDirectory()) continue
    for (const f of fs.readdirSync(path.join(dir, s.name))) {
      if (/^judge-(.+-)?\d+\.json$/.test(f)) judges.push(readJson(path.join(dir, s.name, f)))
    }
  }
  const ids = [...new Set(runs.map((r) => r.scenario))].sort()
  const lines = [
    '# relay 대 맨 CLI 사용성 평가',
    '',
    `- 결과 폴더: \`${dir}\``,
    `- 시작: ${config.startedAt ?? '-'}, 앱 커밋: ${config.commit ?? '-'}, Claude Code: ${config.claudeVersion ?? '-'}`,
    `- 에이전트: ${config.agentModel ?? '-'} (effort ${config.effort ?? '-'}), 사람 역할: ${config.humanModel ?? '-'}, 판정: ${config.judgeModel ?? '-'}`,
    `- 맨 CLI 인자: \`claude ${(config.cliArgs ?? []).join(' ')}\`, 스크린샷 보기: ${config.vision === false ? '끔' : '켬'}`,
    `- 실행 ${runs.length}개, 짝 판정 ${judges.length}개`,
    '',
    '읽는 법: 수치는 평균 ± 표준편차다. 사람 역할과 판정은 AI이므로 경향을 보는 자료로 쓴다. 회차가 적으면 편차가 크다.',
    '걸린 시간에는 사람 역할(AI)이 답을 만드는 동안 기다린 시간이 들어 있다. 두 쪽의 대기를 견줄 때는 그 시간을 뺀 줄을 본다.',
    '',
  ]
  const present = (rs) => [
    ...ARMS.filter((k) => rs.some((r) => r.kind === k)),
    ...[...new Set(rs.map((r) => r.kind))].filter((k) => !ARMS.includes(k)).sort(),
  ]
  const kinds = present(runs)
  const all = (k) => runs.filter((r) => r.kind === k)
  if (ids.length > 1) {
    lines.push(
      '## 전체',
      '',
      table(['지표', ...kinds.map(label)], zipRows(kinds.map((k) => metricRows(all(k))))),
      '',
    )
    if (judges.length) lines.push(...judgeTables(judges))
  }
  for (const id of ids) {
    const sc = loadScenario(id)
    const rs = runs.filter((r) => r.scenario === id)
    const js = judges.filter((j) => j.scenario === id).sort((a, b) => a.index - b.index)
    const own = present(rs)
    lines.push(`## ${id}: ${sc.title}`, '', `목적: ${sc.purpose}`, '')
    lines.push(
      table(
        ['지표', ...own.map(label)],
        zipRows(own.map((k) => metricRows(rs.filter((r) => r.kind === k)))),
      ),
      '',
    )
    if (js.length) lines.push(...judgeTables(js))
    // Work 여럿을 잇는 시나리오: Work마다 따로 보인다. 재는 Work(measure, 기본은 첫 Work를 뺀 모두)를 앞에 둔다
    if (multiWork(sc)) {
      const count = workParts(sc).length
      const measured = measuredWorks(sc)
      const order = [
        ...measured.slice().reverse(),
        ...Array.from({ length: count }, (_, i) => count - 1 - i).filter(
          (n) => !measured.includes(n),
        ),
      ]
      for (const n of order) {
        const teammate = workParts(sc)[n]?.teammate ? ', 팀원 교대' : ''
        lines.push(
          `### Work ${n + 1}${measured.includes(n) ? ' (재는 Work' + teammate + ')' : teammate ? ' (팀원 교대)' : ''}`,
          '',
          table(
            ['지표', ...own.map(label)],
            zipRows(
              own.map((k) =>
                workRows(
                  rs.filter((r) => r.kind === k),
                  n,
                ),
              ),
            ),
          ),
          '',
        )
      }
    }
    for (const k of own.filter((x) => x !== 'cli')) {
      const steps = stepRows(rs.filter((r) => r.kind === k))
      if (!steps.length) continue
      lines.push(
        `### ${label(k)} 단계별 에이전트`,
        '',
        '단계 task 하나의 평균이다. 입력은 캐시 읽기와 쓰기를 더한 값이고, 대화 기록을 찾지 못한 세션은 빼고 센다.',
        '',
        table(
          [
            '단계',
            'task 수',
            '입력 토큰(천)',
            '캐시 쓰기(천)',
            '출력 토큰(천)',
            'context.md 글자',
            '넣은 지식 글자',
          ],
          steps,
        ),
        '',
      )
    }
    lines.push('### 회차별', '')
    lines.push(
      table(
        ['쪽#회차', '끝', '시험', '분', '차례', 'friction', '에이전트 세션', '비고'],
        rs
          .sort((a, b) => a.kind.localeCompare(b.kind) || a.index - b.index)
          .map((r) => [
            `${r.kind}#${r.index}`,
            r.ending,
            r.outcome.checks.map((c) => (c.pass ? 'O' : 'X')).join(''),
            f1(r.wallMs / 60000),
            r.human.turns,
            f2(r.human.frictionMean),
            r.agent.sessions,
            clip((r.error ?? r.summary ?? '').split('\n')[0], 80).replace(/\|/g, '/'),
          ]),
      ),
      '',
    )
    for (const j of js) {
      lines.push(
        `- 판정 #${j.index}: 결과 선호 ${j.outcome.preferred} — ${j.outcome.reason}`,
        `  - 경험 전체 ${j.experience.overall.winner} (${pairOfJudge(j)
          .map((k) => `${label(k)} ${scoreOf(j, k)}`)
          .join(', ')}) — ${j.experience.reason}`,
      )
    }
    if (js.length) lines.push('')
    lines.push('### 사람 역할의 말', '')
    for (const k of own) {
      const notes = rs
        .filter((r) => r.kind === k)
        .flatMap((r) => [
          ...(r.survey
            ? [
                `[${k}#${r.index} 좋음] ${r.survey.best}`,
                `[${k}#${r.index} 불편] ${r.survey.worst}`,
              ]
            : []),
        ])
      lines.push(...notes.map((x) => `- ${x}`))
    }
    lines.push('', '#### friction이 높았던 차례', '')
    for (const r of rs) {
      const file = path.join(r.dir, 'turns.jsonl')
      const high = readJsonl(file).filter((t) => t.friction >= 2)
      for (const t of high.slice(0, 5))
        lines.push(
          `- ${r.kind}#${r.index} 차례 ${t.turn} (friction ${t.friction}): ${t.friction_note || t.thought}`,
        )
    }
    lines.push('')
  }
  const text = lines.join('\n')
  fs.writeFileSync(path.join(dir, 'report.md'), text)
  writeJson(path.join(dir, 'report.json'), {
    config,
    runs: runs.map(({ dir: d, ...r }) => ({
      ...r,
      dir: path.relative(dir, d),
      outcome: { ...r.outcome, trees: undefined },
    })),
    judges,
  })
  return text
}

function zipRows(sets) {
  return sets[0].map((row, i) => [row[0], ...sets.map((s) => s[i][1])])
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2]
  if (!dir) {
    console.error('쓰는 법: node eval/report.mjs <결과 폴더> [--rejudge]')
    process.exit(2)
  }
  const abs = path.resolve(dir)
  if (process.argv.includes('--rejudge')) {
    const config = readJson(path.join(abs, 'config.json'), {})
    await judgeAll(
      abs,
      { judgeModel: config.judgeModel ?? 'sonnet', pairs: config.pairs ?? null },
      { redo: true },
    )
  }
  console.log(buildReport(abs))
}
