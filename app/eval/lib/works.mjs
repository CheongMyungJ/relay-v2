// Work 여럿을 잇는 시나리오. scenario.json의 works에 Work마다 report, knowledge, checks를 둔다.
// 레포, 선호, 기대 파일, 제한(Work마다)은 시나리오 하나가 같이 쓴다. works가 없는 시나리오는 Work 하나다.
// 지식 실험(docs/knowledge-experiment/protocol.md)에서 더한 것:
// - Work의 `teammate: true`: 그 Work는 팀의 다른 사람이 한다. 도구가 앞 Work들의 브랜치를 main에 머지하고(PR 머지와 같음),
//   레포를 새로 clone해 새 앱 저장소(relay)나 새 터미널(맨 CLI)에서 시작한다. 레포로 건너가지 않은 지식은 닿지 않는다.
// - knowledge 항목의 `carry: true`: 앞 Work에서 사람이 이미 알려 줬거나 알려 줄 수 있었던 사실이다. 사람 역할이 이것을
//   다시 알려 준 횟수(carriedTold)가 "다시 말하게 한 부담"이다.
// - 시나리오의 `measure`: 재는 Work의 번호(1부터). 없으면 첫 Work를 뺀 모두다.
// 장기 평가(relay-v3 docs/m3-design.md 6절)에서 더한 것(`sequence`가 있는 시나리오, docs/eval.md 5절):
// - `rules`: 사람만 아는 규칙 { id, text, changes?: [{ work, text }] }. Work의 `rules`가 그 Work에 드는 규칙의 id다.
//   처음 드는 Work에서는 '물으면 답함', 그 뒤는 '이미 말함'(carry)이다. 바뀌는 Work(changes.work)에서는 요청이 새 규칙을
//   말하므로 '처음부터 앎'이고, 그 뒤는 새 글로 '이미 말함'이다.
// - `sequence.chain`: 앞 Work의 결과가 다음 Work의 기준이다. 앞 Work의 숨긴 시험은 뒤에서도 돈다(누적 회귀). Work의
//   `retires`(시험 이름)는 그 Work부터 그 시험을 빼고(규칙이 바뀌어 옛 시험이 틀려짐), 뒤에서 도는 앞 Work의 시험에는
//   `regression: true`를 붙인다.
// - Work의 `type`: 그 Work의 업무 유형(없으면 시나리오의 type).
import { armBase, armType, isRelay3 } from './kind.mjs'

/** 장기 평가 시나리오(scenario.sequence) */
export const isSequence = (scenario) => !!scenario?.sequence && Array.isArray(scenario.works)

/**
 * n번째 Work(0부터)에 드는 사람만 아는 규칙을 그 Work의 사람 지식으로 바꾼다(앞에 둔다). 항목에 rule(규칙 id)을 붙인다
 * @returns {{ share: string, text: string, rule: string, carry?: true }[]}
 */
export function ruleKnowledge(scenario, n) {
  const works = scenario.works ?? []
  const rules = new Map((scenario.rules ?? []).map((r) => [r.id, r]))
  const out = []
  for (const id of works[n]?.rules ?? []) {
    const rule = rules.get(id)
    if (!rule) continue
    const change = (rule.changes ?? [])
      .filter((c) => c.work <= n + 1)
      .sort((a, b) => a.work - b.work)
      .at(-1)
    const text = change?.text ?? rule.text
    if (change && change.work === n + 1) {
      out.push({ share: 'upfront', text, rule: id })
      continue
    }
    // 지금 글이 쓰이기 시작한 Work부터 이번 Work 앞까지 이 규칙이 든 Work가 있으면 이미 말한 것이다
    const since = (change?.work ?? 1) - 1
    const told = works.slice(since, n).some((w) => (w.rules ?? []).includes(id))
    out.push(
      told ? { share: 'told', text, rule: id, carry: true } : { share: 'on_ask', text, rule: id },
    )
  }
  return out
}

/** Work 목록. works가 없으면 시나리오 자신이 Work 하나다. 장기 평가는 규칙을 Work마다의 지식으로 펼친다 */
export function workParts(scenario) {
  if (!Array.isArray(scenario.works) || scenario.works.length === 0) {
    return [{ report: scenario.report, knowledge: scenario.knowledge, checks: scenario.checks }]
  }
  if (isSequence(scenario))
    return scenario.works.map((w, n) => ({
      ...w,
      knowledge: [...ruleKnowledge(scenario, n), ...(w.knowledge ?? [])],
    }))
  return scenario.works
}

/**
 * n번째 Work(0부터)를 끝낸 레포에서 도는 숨긴 시험. chain이면 그 Work까지의 시험 가운데 뺀 것(retires)을 빼고, 앞 Work의
 * 것에는 regression을 붙인다. chain이 아니면 그 Work의 시험만이다
 */
export function activeChecks(scenario, n) {
  const parts = workParts(scenario)
  if (!isSequence(scenario) || !scenario.sequence.chain) return parts[n]?.checks ?? []
  const retired = new Set(parts.slice(0, n + 1).flatMap((w) => w.retires ?? []))
  return parts
    .slice(0, n + 1)
    .flatMap((w, i) => (w.checks ?? []).map((c) => (i < n ? { ...c, regression: true } : c)))
    .filter((c) => !retired.has(c.name))
}

export const multiWork = (scenario) => Array.isArray(scenario.works) && scenario.works.length > 0

/** 재는 Work의 번호(0부터). Work 하나짜리는 그 Work다 */
export function measuredWorks(scenario) {
  const n = workParts(scenario).length
  if (n === 1) return [0]
  if (Array.isArray(scenario.measure) && scenario.measure.length)
    return scenario.measure.map((x) => x - 1).filter((x) => x >= 0 && x < n)
  return Array.from({ length: n - 1 }, (_, i) => i + 1)
}

/** 모든 Work의 숨긴 시험. 이름은 시나리오 안에서 겹치지 않는다 */
export function allChecks(scenario) {
  return workParts(scenario).flatMap((w) => w.checks ?? [])
}

/** n번째 Work(0부터)만 담은 시나리오. 사람 역할과 판정이 Work 하나짜리처럼 읽는다 */
export function workScenario(scenario, n) {
  const parts = workParts(scenario)
  const w = parts[n]
  if (!w) throw new Error(`${scenario.id}: Work ${n + 1}이 없음`)
  const rest = { ...scenario }
  delete rest.works
  return {
    ...rest,
    ...(w.type ? { type: w.type } : {}),
    report: w.report,
    knowledge: w.knowledge ?? [],
    checks: activeChecks(scenario, n),
    work: { index: n, count: parts.length, teammate: !!w.teammate, mates: mateIndex(parts, n) },
  }
}

/** n번째 Work를 하는 사람이 몇 번째 사람인지(0부터). teammate Work마다 사람이 바뀐다 */
function mateIndex(parts, n) {
  return parts.slice(1, n + 1).filter((w) => w.teammate).length
}

/**
 * 판정의 짝. works가 있는 시나리오는 지식을 켠 relay 대 끈 relay(relay-off)이고, 나머지는 relay 대 맨 CLI다.
 * run.mjs의 --pairs로 바꿀 수 있다
 */
export function pairOf(scenario) {
  if (multiWork(scenario)) return ['relay', 'relay-off']
  // 커스텀 유형 시나리오는 같은 일을 일반 유형으로 한 relay와 견준다 (relay D463)
  return scenario.type === 'custom' ? ['relay', 'relay@general'] : ['relay', 'cli']
}

/**
 * --pairs가 없을 때 판정할 짝. 시나리오의 짝에, 맨 CLI가 함께 돌았으면 relay-v3 쪽(relay3, relay3-noreview 등)과 유형을 정한
 * relay 쪽(relay@auto 등) 각각 대 맨 CLI를 더한다(relay-v3 docs/experiments/m2/protocol.md: 규약의 쪽마다 tests 점수 P2가
 * 있어야 한다). relay3-m21이 돌았으면 relay3-m21 대 relay3-m2p, relay3-m21 대 relay@auto를 더한다(M2.1 규약에는 맨 CLI가
 * 없다). kinds는 이 시나리오에서 돈 쪽들이다. 돌지 않은 쪽의 짝은 judgeAll이 건너뛴다
 */
export function defaultPairs(scenario, kinds = []) {
  const pairs = [pairOf(scenario)]
  const has = (a, b) => pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
  if (kinds.includes('cli'))
    for (const k of kinds) {
      if (k === 'cli' || has(k, 'cli')) continue
      if (isRelay3(k) || (armBase(k) === 'relay' && armType(k))) pairs.push([k, 'cli'])
    }
  // relay-v3 M2.1 규약(docs/m2.1-design.md 14절): relay3-m21의 P2(tests)를 같은 날의 기준(relay3-m2p)과 relay@auto 옆에서 본다
  if (kinds.includes('relay3-m21'))
    for (const k of ['relay3-m2p', 'relay@auto'])
      if (kinds.includes(k) && !has('relay3-m21', k)) pairs.push(['relay3-m21', k])
  return pairs
}

/**
 * 결과 폴더를 합쳐 읽을 때의 쪽 이름. 사람 역할이 hands-off인 실행은 <쪽>-handsoff다(relay-v3 M2 평가 규약 2절).
 * humanMode는 run.json의 options에 있고, 예전 실행은 결과 폴더의 config.json 값(loadRuns가 채움)을 쓴다
 */
export const armOf = (run) =>
  (run.options?.humanMode ?? run.humanMode) === 'hands-off' ? `${run.kind}-handsoff` : run.kind
