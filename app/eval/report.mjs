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

function metricRows(rs) {
  const get = (fn) => stats(rs.map(fn))
  const n = rs.length
  const sv = (k) => get((r) => r.survey?.[k] ?? null)
  return [
    ['숨긴 시험 모두 통과', pct(rs.filter((r) => r.outcome.success).length, n)],
    ['레포 시험 통과', pct(rs.filter((r) => r.outcome.repoTestsPass).length, n)],
    ['커밋까지 됨', pct(rs.filter((r) => r.outcome.committed).length, n)],
    ['사람이 끝냄(done)', pct(rs.filter((r) => r.ending === 'done').length, n)],
    ['걸린 시간(분)', ms(get((r) => r.wallMs / 60000))],
    ['사람 차례 수', ms(get((r) => r.human.turns))],
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
