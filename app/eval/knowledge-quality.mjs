#!/usr/bin/env node
// 지식 후속 평가(docs/knowledge-experiment/followup.md 9절)의 지표. 실험의 고정 파일이 아니다.
// 실행마다 모든 Work가 끝난 뒤 레포에 남는 지식(docs/knowledge/)을 다시 만들고, 시나리오의 기준
// (eval/knowledge-truth/<시나리오>.json)과 견줘 판정 모델이 센다:
//   - 낡은 항목: 지금은 틀린 값이나 상태를 지금 것처럼 적은 항목 (문제 1: 옛 지식과 새 지식이 함께 남음)
//   - 상태를 규칙처럼 적은 항목: 아직 고치지 않은 곳이나 정하지 않은 것을 규칙으로 적은 항목 (문제 2)
//   - 서로 어긋나는 항목 짝, 기준 규칙마다 맞게 적었는지(맞음/틀림/없음)
//   - 머리글의 kind가 내용과 맞지 않는 항목
// kind 분포(머리글 kind마다 파일 수, 머리글이 없는 옛 형식은 "없음")는 기준이 없는 시나리오에서도 센다.
// 레포에 남는 지식: Work의 diff(final/<id>.diff)는 시나리오 repo/에서 그 Work 끝까지의 차이다. 팀원 Work는 앞 Work를
// 머지한 main에서 시작하므로 그 diff의 지식이 레포 전체다. 같은 사람의 Work는 main에서 따로 시작하므로 앞 Work의 지식
// 위에 덮는다(같은 경로는 뒤 Work가 이긴다, 머지에서 뒤 브랜치를 고르는 것과 같음).
//   node eval/knowledge-quality.mjs <결과 폴더>... [--model sonnet] [--redo] [--out 파일.md]
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { ask } from './lib/ai.mjs'
import { makeClaudeConfig } from './lib/env.mjs'
import { workParts } from './lib/works.mjs'
import { loadRuns, loadScenario } from './report.mjs'

const TRUTH = path.join(import.meta.dirname, 'knowledge-truth')
const KNOWLEDGE = /^docs\/knowledge\/.+\.md$/

/** diff에서 지식 파일마다 마지막 내용(새 파일의 + 줄). 지운 파일은 null */
export function knowledgeInDiff(diff) {
  const out = new Map()
  for (const part of diff.split(/^(?=diff --git )/m)) {
    const head = part.match(/^diff --git a\/\S+? b\/(?:tree|base)\/(\S+)/)
    if (!head || !KNOWLEDGE.test(head[1]) || /README\.md$/.test(head[1])) continue
    if (/^deleted file mode/m.test(part)) {
      out.set(head[1], null)
      continue
    }
    if (!/^--- \/dev\/null/m.test(part)) {
      // 시나리오 repo/에는 지식이 없으므로 모든 지식 파일은 새 파일로 나온다
      throw new Error(`새 파일이 아닌 지식 diff: ${head[1]}`)
    }
    const body = part
      .split(/^@@[^\n]*\n/m)
      .slice(1)
      .join('')
    const lines = body
      .split('\n')
      .filter((l) => l.startsWith('+'))
      .map((l) => l.slice(1))
    out.set(head[1], lines.join('\n') + '\n')
  }
  return out
}

/** 실행의 마지막 지식: [{ path, text }] */
export function finalKnowledge(run, scenario) {
  const parts = workParts(scenario)
  let state = new Map()
  run.works.forEach((w, n) => {
    const file = path.join(run.dir, 'final', `${w.id}.diff`)
    if (!fs.existsSync(file)) return
    const k = knowledgeInDiff(fs.readFileSync(file, 'utf8'))
    if (parts[n]?.teammate) state = new Map()
    for (const [p, text] of k) {
      if (text === null) state.delete(p)
      else state.set(p, text)
    }
  })
  return [...state].sort(([a], [b]) => (a < b ? -1 : 1)).map(([p, text]) => ({ path: p, text }))
}

export const KINDS = ['rule', 'fact', 'history', 'pitfall', '없음', '기타']

/** 지식 파일 머리글의 kind. 머리글이 없으면 '없음', 정한 값이 아니면 '기타' */
export function kindOf(text) {
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!fm) return '없음'
  const k = fm[1].match(/^kind:\s*([^\s#]+)/m)?.[1]
  if (!k) return '없음'
  return KINDS.includes(k) ? k : '기타'
}

/** verify에서 지식 확인으로 되돌려진 수 (task.bounced 가운데 지식을 말한 것) */
function knowledgeBounces(run) {
  let n = 0
  for (const w of run.works) {
    const file = path.join(run.dir, 'works', path.basename(w.dir), 'events.jsonl')
    if (!fs.existsSync(file)) continue
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line.includes('"task.bounced"')) continue
      if (/지식/.test(line)) n++
    }
  }
  return n
}

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          stale: { type: 'boolean' },
          staleWhy: { type: 'string' },
          stateAsRule: { type: 'boolean' },
          stateWhy: { type: 'string' },
          kindFits: { type: 'boolean' },
          kindWhy: { type: 'string' },
        },
        required: ['path', 'stale', 'staleWhy', 'stateAsRule', 'stateWhy', 'kindFits', 'kindWhy'],
      },
    },
    contradictions: {
      type: 'array',
      items: {
        type: 'object',
        properties: { a: { type: 'string' }, b: { type: 'string' }, why: { type: 'string' } },
        required: ['a', 'b', 'why'],
      },
    },
    rules: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: ['correct', 'wrong', 'missing'] },
          why: { type: 'string' },
        },
        required: ['id', 'status', 'why'],
      },
    },
  },
  required: ['items', 'contradictions', 'rules'],
}

async function judge(entries, truth, opts, workDir) {
  const list = (xs) => xs.map((x) => `- ${x.id}: ${x.text}`).join('\n') || '- 없음'
  const prompt = [
    '어느 레포의 `docs/knowledge/`에 팀이 남긴 지식 파일들이 있다. 모든 일이 끝난 지금 시점의 사실(기준)과 견줘 지식의 질을 가려라.',
    '',
    '## 기준: 지금 맞는 규칙',
    list(truth.rules),
    '',
    '## 기준: 지금은 낡은 서술',
    list(truth.stale),
    '',
    '## 기준: 규칙이 아닌 것(현재 상태, 정하지 않은 것)',
    list(truth.notRules ?? []),
    '',
    '## 가릴 것',
    '- items: 파일마다',
    '  - stale: 지금은 틀린 값이나 상태를 지금 것처럼 적었나(위 "낡은 서술" 기준). 바뀐 이력 절이나 "전에는", "~까지는"처럼 과거로 밝힌 서술은 낡은 것이 아니다. 기준에 없는 사소한 것은 보지 않는다',
    '  - stateAsRule: 위 "규칙이 아닌 것"을 규칙·사실·예외 규칙처럼 적었나. "아직 규칙을 따르지 않는 곳" 같은 절에 적었거나 본문에서 "아직 고치지 않음", "다음에 고칠 예정", "정하지 않음"처럼 현재 상태임을 밝혔으면 false다',
    '  - kindFits: 머리글의 `kind`가 내용과 맞나. rule은 이래야 하는 것(규칙, 관례), fact는 업무 사실이나 코드만 보고는 알기 어려운 사실, history는 언제 무엇을 왜 바꿨나, pitfall은 다시 겪을 만한 실패 유형과 그 위치다. 머리글에 kind가 없으면 true',
    '  - staleWhy, stateWhy, kindWhy: 문제가 있으면(stale, stateAsRule이 true거나 kindFits가 false면) 그 문장이나 까닭을 짧게 적고, 없으면 빈 문자열',
    '- contradictions: 지금 시점에 서로 어긋나는 내용을 말하는 파일 짝(같은 대상에 다른 값이나 다른 규칙). 없으면 빈 배열',
    '- rules: 기준 규칙마다 지식 어딘가에 지금 맞게 적혀 있으면 correct, 틀리게(옛 값 포함) 적혀 있고 맞게 적힌 곳이 없으면 wrong, 어디에도 없으면 missing',
    '',
    `## 지식 파일 (${entries.length}개)`,
    ...entries.map((e) => `\n### ${e.path}\n\n\`\`\`\`markdown\n${e.text.trim()}\n\`\`\`\``),
  ].join('\n')
  const res = await ask({
    prompt,
    model: opts.model,
    effort: 'medium',
    schema: SCHEMA,
    cwd: workDir,
    configDir: makeClaudeConfig(path.join(workDir, 'cfg-kq')),
    tools: [],
    timeoutMs: 300_000,
  })
  return res.data
}

function kindCounts(entries) {
  const out = Object.fromEntries(KINDS.map((k) => [k, 0]))
  for (const e of entries) out[kindOf(e.text)]++
  return out
}

function score(entries, j, truth, bounces) {
  const kinds = kindCounts(entries)
  if (!j || !truth) return { files: entries.length, kinds, bounces }
  const items = j.items ?? []
  const judgedKind = items.length > 0 && items.every((i) => typeof i.kindFits === 'boolean')
  return {
    files: entries.length,
    kinds,
    kindMismatch: judgedKind ? items.filter((i) => !i.kindFits).length : null,
    stale: items.filter((i) => i.stale).length,
    stateAsRule: items.filter((i) => i.stateAsRule).length,
    contradictions: (j.contradictions ?? []).length,
    rulesCorrect: (j.rules ?? []).filter((r) => r.status === 'correct').length,
    rulesWrong: (j.rules ?? []).filter((r) => r.status === 'wrong').length,
    rulesTotal: truth.rules.length,
    bounces,
  }
}

const kindText = (k) =>
  KINDS.filter((x) => k[x])
    .map((x) => `${x} ${k[x]}`)
    .join(' · ') || '없음'

/** 쪽마다 kind별 파일 수의 합(비율)과 실행당 평균 */
function kindTable(rows, arms) {
  const out = [
    `| 쪽 | 실행 | 파일 | ${KINDS.join(' | ')} |`,
    `|---|---|---|${KINDS.map(() => '---').join('|')}|`,
  ]
  for (const arm of arms) {
    const rs = rows.filter((r) => r.kind === arm)
    const files = rs.reduce((a, r) => a + r.files, 0)
    const cell = (k) => {
      const n = rs.reduce((a, r) => a + r.kinds[k], 0)
      return files ? `${n} (${Math.round((100 * n) / files)}%)` : '0'
    }
    out.push(`| ${arm} | ${rs.length} | ${files} | ${KINDS.map(cell).join(' | ')} |`)
  }
  return out
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-')

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      model: { type: 'string', default: 'sonnet' },
      redo: { type: 'boolean', default: false },
      out: { type: 'string' },
    },
  })
  const rows = []
  for (const dir of positionals) {
    for (const run of loadRuns(path.resolve(dir))) {
      if (!run.works?.length) continue
      const truthFile = path.join(TRUTH, `${run.scenario}.json`)
      const truth = fs.existsSync(truthFile) ? JSON.parse(fs.readFileSync(truthFile, 'utf8')) : null
      const scenario = loadScenario(run.scenario)
      const entries = finalKnowledge(run, scenario)
      const file = path.join(run.dir, 'knowledge-quality.json')
      let saved =
        !values.redo && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null
      if (!saved && truth) {
        const j = entries.length
          ? await judge(entries, truth, values, path.join(run.dir, '.kq'))
          : {
              items: [],
              contradictions: [],
              rules: truth.rules.map((r) => ({ id: r.id, status: 'missing', why: '' })),
            }
        fs.rmSync(path.join(run.dir, '.kq'), { recursive: true, force: true })
        saved = { paths: entries.map((e) => e.path), judgment: j }
        fs.writeFileSync(file, JSON.stringify(saved, null, 2) + '\n')
      }
      const s = score(entries, saved?.judgment, truth, knowledgeBounces(run))
      rows.push({ scenario: run.scenario, kind: run.kind, index: run.index, ...s })
      console.error(`${run.scenario} ${run.kind}-${run.index}: ${JSON.stringify(s)}`)
    }
  }
  const keys = [
    ['files', '파일'],
    ['stale', '낡은 항목'],
    ['stateAsRule', '상태를 규칙으로'],
    ['contradictions', '어긋난 짝'],
    ['rulesCorrect', '맞게 적은 규칙'],
    ['rulesWrong', '틀리게 적은 규칙'],
    ['kindMismatch', 'kind 안 맞음'],
    ['bounces', '지식 되돌림'],
  ]
  const out = ['# 남은 지식의 질 (eval/knowledge-quality.mjs)', '']
  for (const sc of [...new Set(rows.map((r) => r.scenario))].sort()) {
    const scRows = rows.filter((r) => r.scenario === sc)
    const arms = [...new Set(scRows.map((r) => r.kind))].sort()
    const total = scRows[0].rulesTotal
    out.push(`## ${sc}${total ? ` (기준 규칙 ${total}개)` : ' (기준 없음: kind 분포만)'}`, '')
    if (total) {
      out.push(`| 쪽 | 실행 | ${keys.map(([, n]) => n).join(' | ')} |`)
      out.push(`|---|---|${keys.map(() => '---').join('|')}|`)
      for (const arm of arms) {
        const rs = scRows.filter((r) => r.kind === arm)
        out.push(
          `| ${arm} | ${rs.length} | ${keys.map(([k]) => f2(mean(rs.map((r) => r[k]).filter((x) => x != null)))).join(' | ')} |`,
        )
      }
      out.push('')
    }
    out.push(...kindTable(scRows, arms), '')
    if (total) {
      out.push('실행마다:', '')
      for (const r of scRows.sort((a, b) =>
        a.kind === b.kind ? a.index - b.index : a.kind < b.kind ? -1 : 1,
      ))
        out.push(
          `- ${r.kind}-${r.index}: ${keys.map(([k, n]) => `${n} ${r[k] ?? '-'}`).join(', ')}, kind ${kindText(r.kinds)}`,
        )
      out.push('')
    }
  }
  const all = [...new Set(rows.map((r) => r.kind))].sort()
  out.push('## 모든 시나리오의 kind 분포', '', ...kindTable(rows, all), '')
  const text = out.join('\n')
  if (values.out) fs.writeFileSync(values.out, text)
  console.log(text)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
