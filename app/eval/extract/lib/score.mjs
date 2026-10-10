// extract run 평가의 채점 (docs/requirements-extraction-flow.md 17.1, 결정 21, 23; docs/extract-eval.md).
// 모델을 부르지 않는 순수 함수만 둔다. 판정 모델 호출은 judge.mjs가 하고, 여기는 그 입력 조립(judgePrompt)과
// 결과 읽기(applyJudge)를 둔다. app/eval/test/extract.test.mjs가 손으로 쓴 reference.json(만점)과 traps/*.json(해당
// 지표에서 잡힘)으로 이 파일을 지킨다.
//
// 결정론으로 가르는 것: 앵커와 인용(기준 커밋의 파일), 구성 이름, 인벤토리·경계·점검표, 수치의 구성별 값과 단위 상태,
//   누출 카나리. worktree 불변과 스키마 통과는 하네스가 run 때 잰다(runner.mjs).
// 판정 모델이 가르는 것: 정답 항목(det가 없는 recall)과 결과 주장의 정렬, 의미상 금지 주장(must_not), 코드로 풀 수
//   있었는데 미확정으로 둔 것(resolvable). 통과 규칙은 여기 코드가 정한다: 모델이 가리킨 key가 결과에 있어야 한다.
// run 종류(survey, trace, integrate, review, summarize)는 과제 id에서 짐작하지 않고 scenario.json의 kind를 받는다. 결정론
//   규칙은 그 결과 칸이 있는 종류에서만 돈다(DET_KINDS, 결정 54). integrate·review·summarize의 결정론(AI 결정 127): 연결의
//   종류와 양쪽, coverage 칸, 제안 단위, 값·구성 답, 서술 판정, 서술의 전역 ID.

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

/**
 * 인벤토리 이름에 정답 토큰이 있는가. 낱말 경계로 보고, 공백·밑줄·하이픈만 다른 꼴도 같은 이름으로 본다
 * ("DMA1 stream5" = "DMA1_Stream5" = "DMA1 Stream 5", 2026-10-09 6차 측정). 뒤에 숫자·글자가 이어지면 다른 이름이다
 */
export function nameHas(name, tok) {
  if (word(tok).test(name)) return true
  const compact = (x) => x.toLowerCase().replace(/[\s_-]+/g, '')
  const c = compact(name)
  const t = compact(tok)
  if (!t) return false
  for (let i = c.indexOf(t); i >= 0; i = c.indexOf(t, i + 1)) {
    const before = c[i - 1]
    const after = c[i + t.length]
    if (!(before && /[a-z0-9]/.test(before)) && !(after && /[a-z0-9]/.test(after))) return true
  }
  return false
}

/** 초당 횟수: tick/s, ticks per second, interrupts/s */
const RATE = /^(ticks?|interrupts?|틱)\s*(\/\s*(s|sec|second)|per\s+second)$/

/** 수치 단위를 정답의 단위 키로. 괄호·등호 뒤의 설명은 뺀다("Hz (tick/s)" → hz) */
export function unitKey(unit) {
  const u = String(unit ?? '')
    .split(/[(=;,]/)[0]
    .trim()
    .toLowerCase()
  if (!u) return ''
  if (/^(ms|msec|millisecond|milliseconds|밀리초)$/.test(u)) return 'ms'
  if (/^(s|sec|secs|second|seconds|초)$/.test(u)) return 's'
  if (/^(us|µs|microsecond|microseconds)$/.test(u)) return 'us'
  if (/^(hz|hertz)(\s|$)/.test(u)) return 'hz'
  // 초당 횟수는 Hz다("1000 tick/s", "ticks per second", 2026-10-09 6차 측정의 값 글)
  if (RATE.test(u)) return 'hz'
  if (/tick/.test(u)) return 'tick'
  if (/cycle|period|사이클|주기/.test(u)) return 'cycle'
  if (/^(count|counts|times|retries|attempts|tries|회|번)$/.test(u)) return 'count'
  return u
}

const UNIT_TOKEN =
  /(-?\d+(?:\.\d+)?)\s*((?:ticks?|interrupts?|틱)\s*(?:\/\s*(?:s|sec|second)|per\s+second)|milliseconds?|msec|ms|microseconds?|µs|us|seconds?|secs?|s|ticks?|hertz|hz|cycles?|밀리초|초|틱|사이클|회|번)?(?![A-Za-z0-9])/gi

/**
 * 값 글에서 (수, 단위) 후보를 모은다. 모델은 값을 글로 쓴다("20 tick = 200 ms (21 tick이면 210 ms)"). 단위가 붙지
 * 않은 수는 선언한 단위로 본다
 */
export function valueCandidates(text, declared) {
  const out = []
  for (const m of String(text ?? '')
    .replace(/,/g, '')
    .matchAll(UNIT_TOKEN)) {
    const x = Number(m[1])
    if (Number.isNaN(x)) continue
    const tok = (m[2] ?? '').toLowerCase()
    const key = !tok ? declared : tok === '틱' ? 'tick' : tok === '사이클' ? 'cycle' : unitKey(tok)
    out.push({ x, key })
  }
  return out
}

const TIME_UNITS = new Set(['ms', 's', 'us'])

function near(x, set) {
  return set.some((y) => Math.abs(x - y) <= Math.max(1e-9, Math.abs(y) * 0.01))
}

/**
 * 결과의 수치를 정답 수치에 잇는다: symbol이 정답 기호와 같거나 symbol 안에 정답 기호가 낱말로 있으면 그것. symbol이
 * 비었을 때만 expr을 본다(expr에는 계산에 쓴 다른 기호가 나온다: "g_ticks wrap"의 식에 CFG_TICK_HZ)
 */
export function matchQuantity(q, truth) {
  const sym = String(q.symbol ?? '').trim()
  const exact = truth.quantities.find((t) =>
    t.symbols.some((s) => s.toLowerCase() === sym.toLowerCase()),
  )
  if (exact) return exact
  const hay = sym || String(q.expr ?? '')
  return truth.quantities.find((t) => t.symbols.some((s) => word(s).test(hay))) ?? null
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
    const named = expandConfigs(v.configs, truth)
    const cfgs = named.length ? named : truth.configs.map((c) => c.name)
    const cands = valueCandidates(v.value, key)
    const judged = cfgs.filter((c) => cands.some((x) => Array.isArray(t.per_config?.[c]?.[x.key])))
    if (!judged.length) continue
    const ok = judged.map((c) => cands.some((x) => near(x.x, t.per_config[c][x.key] ?? [])))
    if (ok.every(Boolean)) {
      judged.forEach((c) => covers.add(c))
      continue
    }
    if (ok.some(Boolean) && judged.length > 1) errors.push(t.merge_id ?? `m.q.${t.id}.merge`)
    else errors.push(`m.q.${t.id}.value`)
  }
  return { truth: t.id, errors: [...new Set(errors)], covers: [...covers].sort() }
}

/** run 종류 */
export const KINDS = ['survey', 'trace', 'integrate', 'review', 'summarize']

function needKind(kind) {
  if (!KINDS.includes(kind)) throw new Error(`run 종류를 줘야 한다(scenario.json의 kind): ${kind}`)
  return kind
}

/** survey·trace 결과의 지역 key: 모든 객체의 key 칸(판정 캐시의 바이트와 함께 그대로 둔다) */
function legacyKeys(out) {
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

const one = (t) =>
  String(t ?? '')
    .replace(/\s+/g, ' ')
    .trim()
const cfgText = (c) => (c?.length ? ` [configs: ${c.join(', ')}]` : '')
const idsText = (ids) => (ids?.length ? ` [ids: ${ids.join(', ')}]` : '')

/**
 * integrate·review·summarize 결과의 key가 붙은 주장 줄: [절, key, 글]. 판정 모델의 입력(claimLines)과 판정 답의 key 대조
 * (outputKeys)가 이 하나를 써서 판정 모델이 본 key가 곧 인정하는 key다. coverage는 관점 ID, answers·verdicts는 질문·서술 키,
 * summarize의 서술은 차례로 붙인 p1.., h1, r1..이 key다
 */
export function keyedView(out, kind) {
  const rows = []
  const push = (section, key, text) => rows.push([section, key, one(text)])
  if (kind === 'integrate') {
    for (const l of out.links ?? [])
      push(
        'link',
        l.key,
        `${l.kind} ${(l.from ?? []).join(', ')} -> ${(l.to ?? []).join(', ')}; reason: ${l.reason ?? ''}`,
      )
    for (const [p, cells] of Object.entries(out.coverage ?? {}))
      for (const c of cells ?? [])
        push(
          'coverage',
          p,
          `${c.status}${cfgText(c.configs)}${idsText(c.ids)}${c.units?.length ? ` [units: ${c.units.join(', ')}]` : ''}; searches: ${(c.searches ?? []).length}${c.note ? `; note: ${c.note}` : ''}`,
        )
    for (const u of out.units ?? [])
      push(
        'unit',
        u.key,
        `[${u.lens}] ${u.purpose}; scope ${u.scope}; priority ${u.priority}; reason: ${u.reason ?? ''}`,
      )
  } else if (kind === 'review') {
    for (const [q, a] of Object.entries(out.answers ?? {}))
      push(
        'answer',
        q,
        `${a.status}: ${a.text ?? ''}${a.values?.length ? `; values: ${a.values.map((v) => `${v.value}${cfgText(v.configs)}`).join('; ')}` : ''}${a.configs?.length ? `; configs: ${a.configs.join(', ')}` : ''}; anchors: ${(a.anchors ?? []).length}; searches: ${(a.searches ?? []).length}`,
      )
    for (const [k, v] of Object.entries(out.verdicts ?? {}))
      push(
        'verdict',
        k,
        `${v.verdict}; attempts: ${(v.attempts ?? []).join(' | ')}; counter anchors: ${(v.anchors ?? []).length}${v.note ? `; note: ${v.note}` : ''}`,
      )
  } else if (kind === 'summarize') {
    ;(out.overview ?? []).forEach((p, i) =>
      push('overview', `p${i + 1}`, `${p.text}${idsText(p.ids)}`),
    )
    if (out.handoff_summary)
      push('handoff', 'h1', `${out.handoff_summary.text}${idsText(out.handoff_summary.ids)}`)
    ;(out.risks ?? []).forEach((p, i) => push('risk', `r${i + 1}`, `${p.text}${idsText(p.ids)}`))
  }
  for (const u of out.unknowns ?? []) push('unknown', u.key, `${u.question} (needs ${u.needs})`)
  for (const d of out.human_decisions ?? [])
    push('human_decision', d.key, `[${d.trigger}] ${d.question}`)
  return rows
}

/**
 * 결과의 지역 key 모두(판정 답의 key 대조). survey·trace는 모든 객체의 key 칸이고, 새 종류는 keyedView의 key까지 더한다
 * (coverage의 관점 ID, answers·verdicts의 키, summarize 서술의 p1·h1·r1)
 */
export function outputKeys(out, kind) {
  needKind(kind)
  const keys = legacyKeys(out)
  if (kind === 'survey' || kind === 'trace') return keys
  for (const [, key] of keyedView(out, kind)) if (typeof key === 'string') keys.add(key)
  return keys
}

/** 정답 항목이 이 과제에 걸리는가 */
const forTask = (item, task) => item.tasks.includes(task)

/**
 * 결정론 규칙이 도는 종류(결정 54): 인벤토리·구성·경계는 survey 결과에만, 수치·점검표는 trace 결과에만, 연결·coverage·제안
 * 단위는 integrate, 값·구성 답과 서술 판정은 review, 서술의 ID는 summarize 결과에만 있다. 패킷에 없는 ID는 전역 ID를 쓰는
 * integrate와 summarize 둘이다. 다른 종류의 과제에 걸린 같은 항목은 판정 모델이 가른다(judgeItems)
 */
export const DET_KINDS = {
  config: ['survey'],
  inventory: ['survey'],
  boundary: ['survey'],
  config_confirmed: ['survey'],
  inventory_kind: ['survey'],
  config_only: ['survey'],
  config_none: ['survey'],
  quantity: ['trace'],
  checklist_na: ['trace'],
  link: ['integrate'],
  link_forbid: ['integrate'],
  coverage: ['integrate'],
  unit: ['integrate'],
  answer_value: ['review'],
  answer_configs: ['review'],
  verdict: ['review'],
  verdict_forbid: ['review'],
  cites: ['summarize'],
  gid_unknown: ['integrate', 'summarize'],
}

/** det 칸의 규칙 이름(칸 하나) */
export function detKey(det) {
  const keys = Object.keys(det ?? {})
  if (keys.length !== 1 || !DET_KINDS[keys[0]])
    throw new Error(
      `모르는 det: ${JSON.stringify(det)} (있는 것: ${Object.keys(DET_KINDS).join(', ')})`,
    )
  return keys[0]
}

/** 결정론 규칙이 이 종류의 결과에서 돌 수 있는가. 돌 수 없으면 그 항목은 판정 모델이 가른다(judgeItems) */
export const detApplies = (item, kind) => !!item.det && DET_KINDS[detKey(item.det)].includes(kind)

const overlap = (xs, ys) => (xs ?? []).some((x) => (ys ?? []).includes(x))

/** 결과가 가리키는 전역 ID 모두: integrate의 links·coverage, summarize의 서술(규칙 global_refs와 같은 칸) */
export function outputGids(out) {
  const ids = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [])
  return [
    ...(out.links ?? []).flatMap((l) => [...ids(l.from), ...ids(l.to)]),
    ...Object.values(out.coverage ?? {}).flatMap((cells) =>
      (Array.isArray(cells) ? cells : []).flatMap((c) => ids(c.ids)),
    ),
    ...[
      ...(out.overview ?? []),
      ...(out.handoff_summary ? [out.handoff_summary] : []),
      ...(out.risks ?? []),
    ].flatMap((p) => ids(p?.ids)),
  ]
}

/** coverage 칸이 그 상태의 요건을 채우는가: covered는 ids, not_applicable은 searches, unreached는 이 결과의 제안 단위 */
function cellComplete(c, out) {
  if (c.status === 'covered') return (c.ids?.length ?? 0) > 0
  if (c.status === 'not_applicable') return (c.searches?.length ?? 0) > 0
  if (c.status === 'unreached') {
    const keys = new Set((out.units ?? []).map((u) => u.key))
    return (c.units?.length ?? 0) > 0 && c.units.every((k) => keys.has(k))
  }
  return true
}

/** review 답의 값을 정답 수치에 견준다(checkQuantity를 그대로 쓴다: 값 글의 (수, 단위) 후보, 병합, 틀린 값) */
export function checkAnswerValue(answer, quantityId, truth) {
  const t = truth.quantities.find((x) => x.id === quantityId)
  if (!t) throw new Error(`정답에 수치 ${quantityId}가 없음`)
  if (answer?.status !== 'answered') return { truth: t.id, errors: [], covers: [] }
  return checkQuantity(
    { symbol: t.symbols[0], expr: '', unit: '', unit_status: '', values: answer.values ?? [] },
    truth,
  )
}

/**
 * 결정론 채점. recall은 이 종류에서 det가 도는 항목만, must_not은 det가 도는 항목과 수치 오류(trace의 quantities, review의
 * 값 답)를 낸다.
 * @param {object} out 구조화 출력
 * @param {object} truth 정답 파일
 * @param {string} task 과제 id
 * @param {string} kind run 종류(scenario.json)
 * @param {{ ids?: string[] }} [ctx] ids: 패킷(integrate는 기록 목록까지)이 준 전역 ID. det gid_unknown이 쓴다
 */
export function detScore(out, truth, task, kind, ctx = {}) {
  needKind(kind)
  const recall = {}
  const violated = new Set()
  const quantities = (out.quantities ?? []).map((q) => ({ key: q.key, ...checkQuantity(q, truth) }))
  for (const q of quantities) for (const e of q.errors) violated.add(e)
  const answers = {}

  for (const item of truth.recall.filter((r) => forTask(r, task) && detApplies(r, kind))) {
    const d = item.det
    let found = false
    if (d.config)
      found = (out.configs ?? []).some((c) => expandConfigs([c.name], truth).includes(d.config))
    else if (d.inventory)
      found = (out.inventory ?? []).some((i) =>
        d.inventory.some((tok) => nameHas(String(i.name ?? ''), tok)),
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
    } else if (d.link) {
      // 같은 종류에 양쪽이 겹치면 찾음. conflicts는 방향이 없고, swap을 주면 다른 종류도 뒤집힌 방향을 받는다
      const L = d.link
      const swap = L.swap ?? L.kind === 'conflicts'
      found = (out.links ?? []).some(
        (l) =>
          l.kind === L.kind &&
          ((overlap(l.from, L.from) && overlap(l.to, L.to)) ||
            (swap && overlap(l.to, L.from) && overlap(l.from, L.to))),
      )
    } else if (d.coverage) {
      // 그 관점에서 상태가 맞고 요건(ids, searches, 제안 단위)을 채운 칸들의 구성이 정답 구성을 모두 덮으면 찾음
      const C = d.coverage
      const got = new Set(
        (out.coverage?.[C.perspective] ?? [])
          .filter((c) => C.status.includes(c.status) && cellComplete(c, out))
          .flatMap((c) => expandConfigs(c.configs, truth)),
      )
      found = C.configs.every((c) => got.has(c))
    } else if (d.unit) {
      const U = d.unit
      found = (out.units ?? []).some(
        (u) =>
          (!U.lens || u.lens === U.lens) &&
          U.tokens.some((tok) => nameHas(`${u.scope ?? ''} ${u.purpose ?? ''}`, tok)),
      )
    } else if (d.answer_value) {
      const A = d.answer_value
      const t = truth.quantities.find((x) => x.id === A.quantity)
      const r = checkAnswerValue(out.answers?.[A.question], A.quantity, truth)
      answers[A.question] = r
      for (const e of r.errors) violated.add(e)
      const need = Object.keys(t?.per_config ?? {})
      found =
        out.answers?.[A.question]?.status === 'answered' &&
        r.errors.length === 0 &&
        need.every((c) => r.covers.includes(c))
    } else if (d.answer_configs) {
      const A = d.answer_configs
      const a = out.answers?.[A.question]
      const got = expandConfigs(a?.configs, truth)
      found = a?.status === 'answered' && got.join(',') === [...A.configs].sort().join(',')
    } else if (d.verdict) {
      found = d.verdict.accept.includes(out.verdicts?.[d.verdict.statement]?.verdict)
    } else if (d.cites) {
      // 그 자리(risks, overview, handoff, any)의 서술이 가리킨 ID에 정답 ID가 모두(any면 하나라도) 있으면 찾음
      const W = d.cites.where ?? 'any'
      const paras =
        W === 'risks'
          ? (out.risks ?? [])
          : W === 'overview'
            ? (out.overview ?? [])
            : W === 'handoff'
              ? [out.handoff_summary].filter(Boolean)
              : [...(out.overview ?? []), out.handoff_summary, ...(out.risks ?? [])].filter(Boolean)
      const cited = new Set(paras.flatMap((p) => p.ids ?? []))
      found = d.cites.any
        ? d.cites.ids.some((x) => cited.has(x))
        : d.cites.ids.every((x) => cited.has(x))
    }
    recall[item.id] = found
  }

  for (const m of truth.must_not.filter((x) => forTask(x, task) && detApplies(x, kind))) {
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
    } else if (d.config_none) {
      // 어느 구성에도 없는 것(등록되지 않은 처리기 등)을 구성을 달아 인벤토리에 넣으면 위반이다
      const bad = (out.inventory ?? []).some(
        (i) =>
          d.config_none.tokens.some((tok) => word(tok).test(String(i.name ?? ''))) &&
          expandConfigs(i.configs, truth).length > 0,
      )
      if (bad) violated.add(m.id)
    } else if (d.link_forbid) {
      // 금지한 연결: kind가 없으면 어느 종류든. to가 없으면 from에서 나가는 어느 연결이든. merges·conflicts와 종류 없음은
      // 방향을 보지 않는다(구성이 다른 두 주장을 어느 쪽으로 합쳐도 위반)
      const F = d.link_forbid
      const undirected = !F.kind || F.kind === 'merges' || F.kind === 'conflicts'
      const hit = (from, to) => overlap(from, F.from) && (!F.to || overlap(to, F.to))
      const bad = (out.links ?? []).some(
        (l) =>
          (!F.kind || l.kind === F.kind) &&
          (hit(l.from, l.to) || (undirected && hit(l.to, l.from))),
      )
      if (bad) violated.add(m.id)
    } else if (d.verdict_forbid) {
      if (d.verdict_forbid.forbid.includes(out.verdicts?.[d.verdict_forbid.statement]?.verdict))
        violated.add(m.id)
    } else if (d.gid_unknown) {
      if (!ctx.ids)
        throw new Error(`${m.id}: det gid_unknown에는 패킷의 전역 ID(ctx.ids)가 있어야 한다`)
      const known = new Set(ctx.ids)
      if (outputGids(out).some((g) => !known.has(g))) violated.add(m.id)
    }
  }
  return { recall, violated: [...violated].sort(), quantities, answers }
}

/**
 * 판정 모델에 보일 결과 주장. key와 글만 남기고 앵커는 뺀다. survey·trace의 줄은 판정 캐시의 입력 해시와 함께 바이트를 그대로
 * 두고(legacyLines), 새 종류는 keyedView의 줄이다
 */
export function claimLines(out, kind) {
  needKind(kind)
  if (kind === 'survey' || kind === 'trace') return legacyLines(out)
  return [
    ...(out.outcome ? [`outcome: ${out.outcome} - ${out.outcome_reason ?? ''}`] : []),
    ...keyedView(out, kind).map(([section, key, text]) => `${section} ${key}: ${text}`),
  ]
}

/** survey·trace 결과의 주장 줄 */
function legacyLines(out) {
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
        required: ['id', 'violated', 'keys', 'quote', 'hedged'],
        properties: {
          id: { type: 'string' },
          violated: { type: 'boolean' },
          keys: { type: 'array', items: { type: 'string' } },
          quote: { type: 'string' },
          hedged: { type: 'boolean' },
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

/** survey·trace의 판정 지시. 바이트가 판정 캐시의 입력 해시에 들어가므로 고치지 않는다(고치면 기준선을 모두 다시 판정) */
export const JUDGE_SYSTEM = [
  'You grade the output of a firmware analysis run against a hidden answer key.',
  'You get the run output as claim lines ("<section> <key>: <text>") and three item lists. Judge only from the claim lines.',
  'recall: found if one or more claims state the main point of the item, in any language and wording. Text in parentheses in an item gives examples or details; they need not all appear. A claim that states something weaker, vaguer or different is not found. Give the claim keys.',
  'must_not: violated only if a claim asserts, as settled fact, what the item forbids. Copy the shortest violating sentence into quote. Set hedged to true if that claim (or another claim it refers to) marks the point as nominal, assumed, approximate because of an unknown, a document or comment claim, an observation, needing external material, or if it lists the exceptions the item says are missing. A claim that states the opposite is not a violation. If unsure, violated is false.',
  'resolvable: left_unknown only if the run left that point unresolved (an unknown, a question, or "could not determine") instead of resolving it. Give the keys.',
  'Answer every item id exactly once. keys are bare keys such as o1 or q2 (without the section word) and must appear in the claim lines. For items that are not violated, quote is an empty string and hedged is false.',
].join('\n')

/** 새 종류의 판정 지시(AI 결정 127). 통과 규칙(key 대조, 유보, 판정 불가)은 survey·trace와 같고 결과의 모양과 key만 다르다 */
export const JUDGE_SYSTEMS = {
  integrate: [
    'You grade the output of an integrate run against a hidden answer key. The run read the record of earlier firmware analysis runs (claims c-NNNN, units u-NNNN, human decisions h-NNNN), linked records by these global IDs (resolves, supersedes, merges, conflicts), judged the coverage of each perspective per configuration, and proposed new analysis units.',
    'You get the run output as claim lines ("<section> <key>: <text>") and three item lists. Judge only from the claim lines.',
    'recall: found if one or more lines state the main point of the item, in any language and wording. Text in parentheses in an item gives examples or details; they need not all appear. A line that states something weaker, vaguer or different is not found. Give the keys.',
    'must_not: violated only if a line (a link reason, a coverage note, a unit, an unknown) asserts, as settled, what the item forbids. Copy the shortest violating sentence into quote. Set hedged to true if that line marks the point as partial, assumed, a document or comment claim, a candidate, or needing external material, a measurement or a person. A line that states the opposite is not a violation. If unsure, violated is false.',
    'resolvable: left_unknown only if the run left that point open (an unknown, a coverage cell left unknown, or "could not determine") although the record answers it. Give the keys of those lines.',
    'Answer every item id exactly once. keys are bare keys such as l1, n1 or k1, or a perspective id such as lifecycle (without the section word), and must appear in the claim lines. For items that are not violated, quote is an empty string and hedged is false.',
  ].join('\n'),
  review: [
    'You grade the output of a review run against a hidden answer key. The run answered blind questions about a firmware repository (answers q1, q2, ...) and tried to refute statements that earlier runs made (verdicts s1, s2, ...: refuted, overclaimed, needs_more or not_refuted).',
    'You get the run output as claim lines ("<section> <key>: <text>") and three item lists. Judge only from the claim lines.',
    'recall: found if one or more lines state the main point of the item, in any language and wording. Text in parentheses in an item gives examples or details; they need not all appear. A line that states something weaker, vaguer or different is not found. Give the keys.',
    'must_not: violated only if a line asserts, as settled fact, what the item forbids. Copy the shortest violating sentence into quote. Set hedged to true if that line marks the point as nominal, assumed, a document or comment claim, an observation, or needing external material. A line that states the opposite is not a violation. If unsure, violated is false.',
    'resolvable: left_unknown only if the run left that point unresolved (an answer with status unknown, a needs_more verdict, an unknown, or "could not determine") instead of answering it. Give the keys.',
    'Answer every item id exactly once. keys are bare keys such as q1 or s2 (without the section word) and must appear in the claim lines. For items that are not violated, quote is an empty string and hedged is false.',
  ].join('\n'),
  summarize: [
    'You grade the output of a summarize run against a hidden answer key. The run read a packet that lists the record of a firmware analysis (units u-NNNN and their states, claims c-NNNN, reviews, links, coverage gaps) and wrote overview paragraphs (p1, p2, ...), a handoff summary (h1) and risks (r1, r2, ...), each with the global IDs it speaks about.',
    'You get the run output as claim lines ("<section> <key>: <text>") and three item lists. Judge only from the claim lines.',
    'recall: found if one or more lines state the main point of the item, in any language and wording. Text in parentheses in an item gives examples or details; they need not all appear. A line that states something weaker, vaguer or different is not found. Give the keys.',
    'must_not: violated only if a line asserts what the item forbids. Copy the shortest violating sentence into quote. Set hedged to true if that line marks the point as a candidate, unconfirmed, unreviewed, not refuted by a review, lowered by a review, or needing external material. A line that states the opposite is not a violation. If unsure, violated is false.',
    'resolvable: left_unknown only if the run left that point open although the packet settles it. Give the keys.',
    'Answer every item id exactly once. keys are bare keys such as p1, h1 or r2 (without the section word) and must appear in the claim lines. For items that are not violated, quote is an empty string and hedged is false.',
  ].join('\n'),
}

/** 종류의 판정 지시: survey·trace는 JUDGE_SYSTEM 그대로(판정 캐시가 이어진다) */
export function judgeSystem(kind) {
  needKind(kind)
  return JUDGE_SYSTEMS[kind] ?? JUDGE_SYSTEM
}

/** 판정에 넘길 항목: 이 종류에서 결정론 규칙이 도는 recall과 must_not은 뺀다(결정론이 가른다) */
export function judgeItems(truth, task, kind) {
  needKind(kind)
  return {
    recall: truth.recall
      .filter((r) => forTask(r, task) && !detApplies(r, kind))
      .map((r) => ({ id: r.id, statement: r.statement })),
    must_not: truth.must_not
      .filter((m) => forTask(m, task) && !detApplies(m, kind))
      .map((m) => ({ id: m.id, statement: m.statement })),
    resolvable: truth.resolvable
      .filter((r) => forTask(r, task))
      .map((r) => ({ id: r.id, statement: r.statement })),
  }
}

/** 판정 모델의 입력. 정답은 이 프롬프트에만 있고 run에는 가지 않는다 */
export function judgePrompt(out, truth, task, kind) {
  const items = judgeItems(truth, task, kind)
  const list = (xs) => xs.map((x) => `- ${x.id}: ${x.statement}`).join('\n') || '(none)'
  return [
    '# Run output (claim lines)',
    '',
    ...claimLines(out, kind),
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
export function applyJudge(answer, out, truth, task, kind) {
  const items = judgeItems(truth, task, kind)
  const keys = outputKeys(out, kind)
  // 판정 모델은 key 앞에 절 이름을 붙이기도 한다("unknown u1"). 마지막 낱말을 key로 본다
  const valid = (ks) => (ks ?? []).some((k) => keys.has(String(k).trim().split(/\s+/).pop()))
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
    // 판정 모델이 유보했다고 본 주장(공칭, 가정, 문서 주장, 외부 자료 필요, 빠진 예외를 함께 적음)은 위반으로 세지 않는다
    else if (a.violated === true && a.hedged !== true && valid(a.keys)) violated.push(m.id)
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
 * @param {{ out: object, truth: object, task: string, kind: string, anchors: object[], judge: object | null,
 *   leak: boolean, worktreeChanged: boolean, ids?: string[] }} o kind: scenario.json의 run 종류. ids: 패킷이 준 전역 ID
 */
export function scoreRun(o) {
  const det = detScore(o.out, o.truth, o.task, o.kind, { ids: o.ids })
  const j = o.judge
    ? applyJudge(o.judge, o.out, o.truth, o.task, o.kind)
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
