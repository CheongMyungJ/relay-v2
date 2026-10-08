// extract run 평가의 채점 (docs/requirements-extraction-flow.md 17.1, 결정 21, 23; docs/extract-eval.md).
// 모델을 부르지 않는 순수 함수만 둔다. 판정 모델 호출은 judge.mjs가 하고, 여기는 그 입력 조립(judgePrompt)과
// 결과 읽기(applyJudge)를 둔다. app/eval/test/extract.test.mjs가 손으로 쓴 reference.json(만점)과 traps/*.json(해당
// 지표에서 잡힘)으로 이 파일을 지킨다.
//
// 결정론으로 가르는 것: 앵커와 인용(기준 커밋의 파일), 구성 이름, 인벤토리·경계·점검표, 수치의 구성별 값과 단위 상태,
//   누출 카나리. worktree 불변과 스키마 통과는 하네스가 run 때 잰다(runner.mjs).
// 판정 모델이 가르는 것: 정답 항목(det가 없는 recall)과 결과 주장의 정렬, 의미상 금지 주장(must_not), 코드로 풀 수
//   있었는데 미확정으로 둔 것(resolvable). 통과 규칙은 여기 코드가 정한다: 모델이 가리킨 key가 결과에 있어야 한다.

/** 결과의 경로를 레포 상대의 / 경로로 */
export function normPath(p, repoRoot) {
  let s = String(p ?? '').replace(/\\/g, '/')
  const root = String(repoRoot ?? '')
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
  if (root && s.toLowerCase().startsWith(root.toLowerCase() + '/')) s = s.slice(root.length + 1)
  return s.replace(/^\.\//, '').replace(/^\/+/, '')
}

/** 인용 비교용: Read 출력의 줄 번호 머리를 떼고 공백을 하나로 */
export function normQuote(q) {
  return String(q ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/^\s*\d+(\t|→|:\s)/, ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 결과에서 앵커 모양의 객체를 모두 모은다 */
export function collectAnchors(out) {
  const found = []
  const walk = (v, where) => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`))
    else if (v && typeof v === 'object') {
      if ('kind' in v && 'path' in v && 'start' in v && 'end' in v && 'quote' in v)
        found.push({ where, ...v })
      else for (const [k, x] of Object.entries(v)) walk(x, where ? `${where}.${k}` : k)
    }
  }
  walk(out, '')
  return found
}

function includesInOrder(hay, quote) {
  const parts = quote
    .split(/\s*(?:\.\.\.|…)\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (!parts.length) return false
  let at = 0
  for (const p of parts) {
    const i = hay.indexOf(p, at)
    if (i < 0) return false
    at = i + p.length
  }
  return true
}

/**
 * 앵커마다 대조한다. code·doc_claim은 레포 파일(기준 커밋)에서 본다. tool_output·external_spec은 보지 않는다.
 * ok: 줄 범위 안에 인용이 있음. line_mismatch: 파일에는 있으나 범위 밖. fabricated: 파일 어디에도 없음.
 * missing_file: 기준 커밋에 없는 경로. skipped: 보지 않는 종류
 * @param {object[]} anchors collectAnchors의 결과
 * @param {(rel: string) => string | null} readFile 기준 커밋의 파일 내용
 * @param {string} repoRoot run이 본 레포 경로(절대 경로 앵커를 상대로 바꾼다)
 */
export function checkAnchors(anchors, readFile, repoRoot) {
  return anchors.map((a) => {
    if (a.kind !== 'code' && a.kind !== 'doc_claim') return { ...a, status: 'skipped' }
    const rel = normPath(a.path, repoRoot)
    const text = readFile(rel)
    if (text === null) return { ...a, rel, status: 'missing_file' }
    const quote = normQuote(a.quote)
    if (!quote) return { ...a, rel, status: 'fabricated' }
    const lines = text.replace(/\r\n?/g, '\n').split('\n')
    const s = Math.max(1, Number(a.start) || 1)
    const e = Math.max(s, Number(a.end) || s)
    const inRange = normQuote(lines.slice(s - 1, e).join('\n'))
    if (includesInOrder(inRange, quote)) return { ...a, rel, status: 'ok' }
    if (includesInOrder(normQuote(text), quote)) return { ...a, rel, status: 'line_mismatch' }
    return { ...a, rel, status: 'fabricated' }
  })
}

/** 구성 이름 목록을 시나리오 구성 이름으로. all은 모든 구성. 모르는 이름은 ?이름 */
export function expandConfigs(names, truth) {
  const out = new Set()
  for (const raw of names ?? []) {
    const n = String(raw).trim().toLowerCase()
    if (!n) continue
    if (n === 'all' || n === 'both' || n === '*') {
      for (const c of truth.configs) out.add(c.name)
      continue
    }
    const c = truth.configs.find((x) => x.name === n || x.aliases.includes(n))
    out.add(c ? c.name : `?${n}`)
  }
  return [...out].sort()
}

const word = (token) =>
  new RegExp(
    `(^|[^A-Za-z0-9_])${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^A-Za-z0-9_])`,
    'i',
  )

/** 수치 단위를 정답의 단위 키로 */
export function unitKey(unit) {
  const u = String(unit ?? '')
    .trim()
    .toLowerCase()
  if (!u) return ''
  if (/^(ms|msec|millisecond|milliseconds|밀리초)$/.test(u)) return 'ms'
  if (/^(s|sec|secs|second|seconds|초)$/.test(u)) return 's'
  if (/^(us|µs|microsecond|microseconds)$/.test(u)) return 'us'
  if (/tick/.test(u)) return 'tick'
  if (/^(hz|hertz)$/.test(u)) return 'hz'
  if (/cycle|period/.test(u)) return 'cycle'
  if (/^(count|counts|times|retries|attempts|tries|회|번)$/.test(u)) return 'count'
  return u
}

const TIME_UNITS = new Set(['ms', 's', 'us'])

function num(v) {
  const m = /-?\d+(?:\.\d+)?/.exec(String(v ?? '').replace(/,/g, ''))
  return m ? Number(m[0]) : NaN
}

function near(x, set) {
  return set.some((y) => Math.abs(x - y) <= Math.max(1e-9, Math.abs(y) * 0.01))
}

/** 결과의 수치를 정답 수치에 잇는다: symbol이 정답 기호와 같으면 그것, 아니면 expr에 나오는 첫 정답 */
export function matchQuantity(q, truth) {
  const sym = String(q.symbol ?? '').trim()
  const bySymbol = truth.quantities.find((t) =>
    t.symbols.some((s) => s.toLowerCase() === sym.toLowerCase()),
  )
  if (bySymbol) return bySymbol
  return (
    truth.quantities.find((t) => t.symbols.some((s) => word(s).test(`${sym} ${q.expr ?? ''}`))) ??
    null
  )
}

/**
 * 수치 하나를 정답과 견준다. 오류마다 금지 주장 id를 낸다.
 * @returns {{ truth: string | null, errors: string[], covers: string[] }}
 */
export function checkQuantity(q, truth) {
  const t = matchQuantity(q, truth)
  if (!t) return { truth: null, errors: [], covers: [] }
  const errors = []
  const covers = new Set()
  const key = unitKey(q.unit)
  if (!t.unit_derivable && q.unit_status === 'derived' && TIME_UNITS.has(key))
    errors.push(t.overclaim_id ?? `m.q.${t.id}.overclaim`)
  for (const v of q.values ?? []) {
    const x = num(v.value)
    if (Number.isNaN(x)) continue
    const named = expandConfigs(v.configs, truth)
    const cfgs = named.length ? named : truth.configs.map((c) => c.name)
    const sets = cfgs.map((c) => t.per_config?.[c]?.[key]).filter(Array.isArray)
    if (!sets.length) continue
    const ok = sets.map((s) => near(x, s))
    if (ok.every(Boolean)) {
      cfgs.forEach((c) => covers.add(c))
      continue
    }
    if (ok.some(Boolean) && cfgs.length > 1) errors.push(t.merge_id ?? `m.q.${t.id}.merge`)
    else errors.push(`m.q.${t.id}.value`)
  }
  return { truth: t.id, errors: [...new Set(errors)], covers: [...covers].sort() }
}

/** 결과의 지역 key 모두 */
export function outputKeys(out) {
  const keys = new Set()
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') {
      if (typeof v.key === 'string') keys.add(v.key)
      Object.values(v).forEach(walk)
    }
  }
  walk(out)
  return keys
}

/** 정답 항목이 이 과제에 걸리는가 */
const forTask = (item, task) => item.tasks.includes(task)

/**
 * 결정론 채점. recall은 det가 있는 항목만, must_not은 det가 있는 항목과 수치 오류를 낸다.
 * @param {object} out 구조화 출력
 * @param {object} truth 정답 파일
 * @param {string} task 과제 id
 */
export function detScore(out, truth, task) {
  const recall = {}
  const violated = new Set()
  const quantities = (out.quantities ?? []).map((q) => ({ key: q.key, ...checkQuantity(q, truth) }))
  for (const q of quantities) for (const e of q.errors) violated.add(e)

  for (const item of truth.recall.filter((r) => forTask(r, task) && r.det)) {
    const d = item.det
    let found = false
    if (d.config)
      found = (out.configs ?? []).some((c) => expandConfigs([c.name], truth).includes(d.config))
    else if (d.inventory)
      found = (out.inventory ?? []).some((i) =>
        d.inventory.some((tok) => word(tok).test(String(i.name ?? ''))),
      )
    else if (d.boundary)
      found = (out.boundaries ?? []).some((b) =>
        normPath(b.path).toLowerCase().startsWith(d.boundary.toLowerCase()),
      )
    else if (d.quantity) {
      const t = truth.quantities.find((x) => x.id === d.quantity)
      const hits = quantities.filter((q) => q.truth === d.quantity)
      const need = Object.keys(t?.per_config ?? {})
      const covered = new Set(hits.flatMap((q) => q.covers))
      found =
        hits.length > 0 &&
        hits.every((q) => q.errors.length === 0) &&
        need.every((c) => covered.has(c))
    } else if (d.checklist_na) {
      const c = out.checklist?.[d.checklist_na]
      found = c?.status === 'not_applicable' && (c.searches?.length ?? 0) > 0
    }
    recall[item.id] = found
  }

  for (const m of truth.must_not.filter((x) => forTask(x, task) && x.det)) {
    const d = m.det
    if (d.config_confirmed) {
      if (
        (out.configs ?? []).some(
          (c) =>
            d.config_confirmed.includes(String(c.name).toLowerCase()) && c.status === 'confirmed',
        )
      )
        violated.add(m.id)
    } else if (d.inventory_kind) {
      if ((out.inventory ?? []).some((i) => i.kind === d.inventory_kind)) violated.add(m.id)
    } else if (d.config_only) {
      const bad = (out.inventory ?? []).some((i) => {
        if (!d.config_only.tokens.some((tok) => word(tok).test(String(i.name ?? '')))) return false
        const cfgs = expandConfigs(i.configs, truth)
        return cfgs.some((c) => !d.config_only.configs.includes(c))
      })
      if (bad) violated.add(m.id)
    }
  }
  return { recall, violated: [...violated].sort(), quantities }
}

/** 판정 모델에 보일 결과 주장. key와 글만 남기고 앵커는 뺀다 */
export function claimLines(out) {
  const lines = []
  const cfg = (c) => (c?.length ? ` [configs: ${c.join(', ')}]` : '')
  const push = (section, key, text) =>
    lines.push(`${section} ${key}: ${String(text).replace(/\s+/g, ' ').trim()}`)
  if (out.outcome) lines.push(`outcome: ${out.outcome} - ${out.outcome_reason ?? ''}`)
  for (const c of out.configs ?? [])
    push(
      'config',
      c.key,
      `${c.name} (${c.status}); select: ${c.select}; build: ${c.build_command ?? '-'}`,
    )
  for (const i of out.inventory ?? [])
    push('inventory', i.key, `${i.kind} ${i.name}${cfg(i.configs)} ${i.notes ?? ''}`)
  for (const b of out.boundaries ?? []) push('boundary', b.key, `${b.kind} ${b.path}: ${b.reason}`)
  for (const o of out.observations ?? [])
    push('observation', o.key, `${o.text}${cfg(o.configs)}${o.inference ? ' (inference)' : ''}`)
  for (const q of out.quantities ?? [])
    push(
      'quantity',
      q.key,
      `${q.symbol} = ${q.expr}; values: ${(q.values ?? []).map((v) => `${v.value}${cfg(v.configs)}`).join('; ')}; unit ${q.unit || '?'} (${q.unit_status}); nature ${q.nature}`,
    )
  for (const r of out.requirements ?? [])
    push(
      'requirement',
      r.key,
      `[${r.type}, basis ${r.basis}] when ${r.condition}, ${r.behavior}, then ${r.result}${cfg(r.configs)}`,
    )
  for (const c of out.constraints ?? [])
    push('constraint', c.key, `[${c.area}] ${c.text}${cfg(c.configs)}; reason: ${c.reason}`)
  for (const c of out.impl_choices ?? []) push('impl_choice', c.key, c.text)
  for (const u of out.unknowns ?? []) push('unknown', u.key, `${u.question} (needs ${u.needs})`)
  for (const c of out.conflicts ?? [])
    push('conflict', c.key, `${c.text} | ${(c.sides ?? []).map((s) => s.claim).join(' | ')}`)
  for (const a of out.absences ?? [])
    push('absence', a.key, `${a.claim}${cfg(a.configs)}; searches: ${(a.searches ?? []).length}`)
  for (const [id, c] of Object.entries(out.checklist ?? {}))
    lines.push(`checklist ${id}: ${c.status}${c.refs?.length ? ` refs ${c.refs.join(',')}` : ''}`)
  for (const u of [...(out.units ?? []), ...(out.followups ?? [])])
    push('unit', u.key, `[${u.lens}] ${u.purpose}; scope ${u.scope}`)
  for (const n of out.not_found ?? []) push('not_found', n.key, n.what)
  for (const d of out.human_decisions ?? [])
    push('human_decision', d.key, `[${d.trigger}] ${d.question}`)
  return lines
}

/** 판정 모델의 결과 스키마 */
export const JUDGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['recall', 'must_not', 'resolvable'],
  properties: {
    recall: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'found', 'keys'],
        properties: {
          id: { type: 'string' },
          found: { type: 'boolean' },
          keys: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    must_not: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'violated', 'keys'],
        properties: {
          id: { type: 'string' },
          violated: { type: 'boolean' },
          keys: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    resolvable: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'left_unknown', 'keys'],
        properties: {
          id: { type: 'string' },
          left_unknown: { type: 'boolean' },
          keys: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}

export const JUDGE_SYSTEM = [
  'You grade the output of a firmware analysis run against a hidden answer key.',
  'You get the run output as numbered claim lines ("<section> <key>: <text>") and three item lists.',
  'recall: an item is found only if one or more claims state it (paraphrase is fine, partial is not). Give the claim keys.',
  'must_not: violated only if a claim asserts what the item forbids. A claim that marks the point as uncertain, as a document claim or as an observation, or that states the opposite, is not a violation. Give the claim keys.',
  'resolvable: left_unknown only if the run left that point unresolved (an unknown, a question, or "could not determine") instead of resolving it. Give the keys.',
  'Answer every item id exactly once. Use only keys that appear in the claim lines. Judge only from the claim lines.',
].join('\n')

/** 판정에 넘길 항목: det가 있는 recall과 must_not은 뺀다(결정론이 가른다) */
export function judgeItems(truth, task) {
  return {
    recall: truth.recall
      .filter((r) => forTask(r, task) && !r.det)
      .map((r) => ({ id: r.id, statement: r.statement })),
    must_not: truth.must_not
      .filter((m) => forTask(m, task) && !m.det)
      .map((m) => ({ id: m.id, statement: m.statement })),
    resolvable: truth.resolvable
      .filter((r) => forTask(r, task))
      .map((r) => ({ id: r.id, statement: r.statement })),
  }
}

/** 판정 모델의 입력. 정답은 이 프롬프트에만 있고 run에는 가지 않는다 */
export function judgePrompt(out, truth, task) {
  const items = judgeItems(truth, task)
  const list = (xs) => xs.map((x) => `- ${x.id}: ${x.statement}`).join('\n') || '(none)'
  return [
    '# Run output (claim lines)',
    '',
    ...claimLines(out),
    '',
    '# recall items',
    list(items.recall),
    '',
    '# must_not items',
    list(items.must_not),
    '',
    '# resolvable items',
    list(items.resolvable),
    '',
  ].join('\n')
}

/**
 * 판정 모델의 답을 규칙으로 읽는다: 모르는 id는 버리고, 답이 없는 id는 판정 불가(null), 가리킨 key가 결과에 없으면
 * 인정하지 않는다
 */
export function applyJudge(answer, out, truth, task) {
  const items = judgeItems(truth, task)
  const keys = outputKeys(out)
  const valid = (ks) => (ks ?? []).some((k) => keys.has(k))
  const pick = (list, id) => (answer?.[list] ?? []).find((x) => x.id === id)
  const recall = {}
  for (const r of items.recall) {
    const a = pick('recall', r.id)
    recall[r.id] = a ? a.found === true && valid(a.keys) : null
  }
  const violated = []
  const undecided = []
  for (const m of items.must_not) {
    const a = pick('must_not', m.id)
    if (!a) undecided.push(m.id)
    else if (a.violated === true && valid(a.keys)) violated.push(m.id)
  }
  const softened = []
  for (const r of items.resolvable) {
    const a = pick('resolvable', r.id)
    if (a?.left_unknown === true && valid(a.keys)) softened.push(r.id)
  }
  return { recall, violated, undecided, softened }
}

/**
 * run 하나의 점수. det와 judge를 합친다. 판정 불가(null)인 recall 항목은 분모에서 뺀다(issue-judge와 같음)
 * @param {{ out: object, truth: object, task: string, anchors: object[], judge: object | null, leak: boolean,
 *   worktreeChanged: boolean }} o
 */
export function scoreRun(o) {
  const det = detScore(o.out, o.truth, o.task)
  const j = o.judge
    ? applyJudge(o.judge, o.out, o.truth, o.task)
    : { recall: {}, violated: [], undecided: [], softened: [] }
  const recall = { ...j.recall, ...det.recall }
  const decided = Object.values(recall).filter((v) => v !== null)
  const violated = [...new Set([...det.violated, ...j.violated])].sort()
  const code = o.anchors.filter((a) => a.status !== 'skipped')
  const count = (s) => code.filter((a) => a.status === s).length
  return {
    pmA: violated.length,
    pmB: decided.length ? decided.filter(Boolean).length / decided.length : null,
    recall,
    violated,
    undecided: j.undecided,
    softened: j.softened,
    anchors: {
      total: code.length,
      ok: count('ok'),
      lineMismatch: count('line_mismatch'),
      fabricated: count('fabricated') + count('missing_file'),
    },
    gates: { leak: o.leak, worktreeChanged: o.worktreeChanged },
    judged: !!o.judge,
  }
}

/** 출력에 정답의 누출 카나리가 있는가 */
export function hasLeak(text, truth) {
  return !!truth.canary && String(text).includes(truth.canary)
}
