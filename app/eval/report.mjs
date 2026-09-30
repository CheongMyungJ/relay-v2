#!/usr/bin/env node
// 결과 폴더를 모아 report.md와 report.json을 만든다. run.mjs가 끝에 부르고, 따로 다시 돌릴 수도 있다.
//   node eval/report.mjs <결과 폴더>            요약만 다시 만든다
//   node eval/report.mjs <결과 폴더> --rejudge  짝 판정을 다시 하고 요약한다
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DIMENSIONS, judgePair } from './lib/judge.mjs'
import { clip, readJson, readJsonl, stats, writeJson } from './lib/util.mjs'

const SCENARIOS = path.resolve(import.meta.dirname, 'scenarios')

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
    for (const i of indexes) {
      const relay = runs.find((r) => r.scenario === id && r.kind === 'relay' && r.index === i)
      const cli = runs.find((r) => r.scenario === id && r.kind === 'cli' && r.index === i)
      if (!relay || !cli) continue
      const file = path.join(dir, id, `judge-${i}.json`)
      if (!redo && fs.existsSync(file)) {
        out.push(readJson(file))
        continue
      }
      console.log(`[판정] ${id} #${i}`)
      try {
        const j = await judgePair({
          scenario,
          relay,
          cli,
          relayDir: relay.dir,
          cliDir: cli.dir,
          opts,
          workDir: path.join(
            opts.workRoot ?? path.join(os.tmpdir(), 'relay-eval', path.basename(dir)),
            `judge-${id}-${i}`,
          ),
        })
        writeJson(file, j)
        out.push(j)
      } catch (e) {
        console.log(`[판정] ${id} #${i} 실패: ${String(e).slice(0, 300)}`)
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
    ['바뀐 줄 수', ms(get((r) => r.outcome.linesChanged))],
    ['기대 밖 파일 수', ms(get((r) => r.outcome.unrelated.length))],
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
    ]
  })
}

function judgeRows(js) {
  const n = js.length
  const count = (fn) => ({
    relay: js.filter((j) => fn(j) === 'relay').length,
    cli: js.filter((j) => fn(j) === 'cli').length,
  })
  const row = (label, fn) => {
    const c = count(fn)
    const na = js.filter((j) => fn(j) === 'n/a').length
    return [label, `${c.relay}`, `${c.cli}`, `${n - c.relay - c.cli - na}`, `${na}`]
  }
  const rows = [row('결과(가림) 선호', (j) => j.outcome.preferred)]
  for (const d of DIMENSIONS) rows.push(row(`경험: ${d}`, (j) => j.experience[d]?.winner))
  return rows
}

function scoreRows(js) {
  const s = (fn) => ms(stats(js.map(fn)))
  const rows = []
  for (const k of ['correctness', 'scope', 'quality', 'tests']) {
    rows.push([`결과 ${k} (1~5)`, s((j) => j.outcome.relay[k]), s((j) => j.outcome.cli[k])])
  }
  rows.push([
    '경험 점수 (1~10)',
    s((j) => j.experience.relayScore),
    s((j) => j.experience.cliScore),
  ])
  return rows
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
      if (/^judge-\d+\.json$/.test(f)) judges.push(readJson(path.join(dir, s.name, f)))
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
  const kinds = ['relay', 'cli']
  const all = (k) => runs.filter((r) => r.kind === k)
  if (ids.length > 1) {
    lines.push(
      '## 전체',
      '',
      table(['지표', 'relay', '맨 CLI'], zipRows(kinds.map((k) => metricRows(all(k))))),
      '',
    )
    if (judges.length) {
      lines.push(
        table(['짝 판정', 'relay 우세', 'CLI 우세', '비김', '해당 없음'], judgeRows(judges)),
        '',
      )
      lines.push(table(['판정 점수', 'relay', '맨 CLI'], scoreRows(judges)), '')
    }
  }
  for (const id of ids) {
    const sc = loadScenario(id)
    const rs = runs.filter((r) => r.scenario === id)
    const js = judges.filter((j) => j.scenario === id).sort((a, b) => a.index - b.index)
    lines.push(`## ${id}: ${sc.title}`, '', `목적: ${sc.purpose}`, '')
    lines.push(
      table(
        ['지표', 'relay', '맨 CLI'],
        zipRows(kinds.map((k) => metricRows(rs.filter((r) => r.kind === k)))),
      ),
      '',
    )
    if (js.length) {
      lines.push(
        table(['짝 판정', 'relay 우세', 'CLI 우세', '비김', '해당 없음'], judgeRows(js)),
        '',
      )
      lines.push(table(['판정 점수', 'relay', '맨 CLI'], scoreRows(js)), '')
    }
    const steps = stepRows(rs.filter((r) => r.kind === 'relay'))
    if (steps.length) {
      lines.push(
        '### relay 단계별 에이전트',
        '',
        '단계 task 하나의 평균이다. 입력은 캐시 읽기와 쓰기를 더한 값이고, 대화 기록을 찾지 못한 세션은 빼고 센다.',
        '',
        table(
          ['단계', 'task 수', '입력 토큰(천)', '캐시 쓰기(천)', '출력 토큰(천)', 'context.md 글자'],
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
        `  - 경험 전체 ${j.experience.overall.winner} (relay ${j.experience.relayScore}, CLI ${j.experience.cliScore}) — ${j.experience.reason}`,
      )
    }
    if (js.length) lines.push('')
    lines.push('### 사람 역할의 말', '')
    for (const k of kinds) {
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
    await judgeAll(abs, { judgeModel: config.judgeModel ?? 'sonnet' }, { redo: true })
  }
  console.log(buildReport(abs))
}
