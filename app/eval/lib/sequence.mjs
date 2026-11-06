// 장기 평가(sequence, docs/eval.md 5절, relay-v3 docs/m3-design.md 6절)의 순수한 부분: 차례와 이어 돌기, 사람 역할의 기억,
// 누적 숨긴 시험의 요약. 앱·git·모델을 부르지 않는다(eval/test/m3-sequence.test.mjs).
//
// 사람 역할의 기억(persona memory): 같은 사람이 열 전체를 잇는다. Work마다 사람 역할 세션은 새로 두되(화면이 쌓여 맥락이
// 넘치지 않게, 컨테이너가 다시 떠도 이어 가게) 그 사람이 앞 Work에서 실제로 말한 규칙과 앞서 한 일의 목록을 기억 파일
// (persona.json)에 남기고 다음 Work의 사람 지식에 넣는다. 정적인 lib/works.mjs ruleKnowledge는 '규칙이 앞 Work에 들었으면
// 이미 말함'이고, 기억은 '사람이 앞 Work에서 그 규칙을 실제로 말했으면(감사, 없으면 자기 보고) 이미 말함'이다. 규칙이 든
// Work에서 에이전트가 묻지 않아 말하지 않았으면 다음 Work에서도 '물으면 답함'이다. 바뀌는 Work(changes.work)에서는 요청이 새
// 규칙을 말하므로 '처음부터 앎'이고 그 Work가 끝나면 새 글로 말한 것이 된다.
import { workParts, workScenario } from './works.mjs'

/** 빈 기억 */
export const emptyMemory = () => ({ rules: {}, works: [], retold: [] })

/**
 * n번째 Work(0부터)에서 규칙의 지금 글과 그 글이 쓰이기 시작한 Work(1부터). 바뀌지 않았으면 1이다
 * @returns {{ text: string, since: number } | null}
 */
export function ruleTextAt(scenario, id, n) {
  const rule = (scenario.rules ?? []).find((r) => r.id === id)
  if (!rule) return null
  const change = (rule.changes ?? [])
    .filter((c) => c.work <= n + 1)
    .sort((a, b) => a.work - b.work)
    .at(-1)
  return { text: change?.text ?? rule.text, since: change?.work ?? 1 }
}

/**
 * 기억으로 정한 n번째 Work의 사람 지식: 그 Work의 규칙(앞)과 그 Work만의 지식(뒤). 규칙 항목에는 rule(id)을 붙이고, 이미 말한
 * 것은 share told와 carry(다시 말하기 PM1의 분모)다
 */
export function personaKnowledge(scenario, n, memory = emptyMemory()) {
  const w = (scenario.works ?? [])[n]
  if (!w) return []
  const out = []
  for (const id of w.rules ?? []) {
    const at = ruleTextAt(scenario, id, n)
    if (!at) continue
    if (at.since === n + 1 && at.since > 1) {
      out.push({ share: 'upfront', text: at.text, rule: id })
      continue
    }
    const told = memory.rules?.[id]
    out.push(
      told && told.text === at.text
        ? { share: 'told', text: at.text, rule: id, carry: true }
        : { share: 'on_ask', text: at.text, rule: id },
    )
  }
  return [...out, ...(w.knowledge ?? [])]
}

/** 요청 글의 첫 줄(앞서 한 일의 목록) */
const firstLine = (report) => {
  const text = (Array.isArray(report) ? report : [String(report ?? '')]).join('\n')
  const line =
    text
      .split('\n')
      .map((l) => l.trim())
      .find(Boolean) ?? ''
  return line.length > 90 ? `${line.slice(0, 90)}…` : line
}

/**
 * 사람 역할에게 줄 n번째 Work의 시나리오(workScenario에 기억의 지식과 앞서 한 일). human.mjs systemPrompt가 sequence와
 * persona를 보고 장기 평가의 글을 쓴다
 */
export function personaScenario(scenario, n, memory = emptyMemory()) {
  return {
    ...workScenario(scenario, n),
    knowledge: personaKnowledge(scenario, n, memory),
    persona: { works: (memory.works ?? []).filter((x) => x.work <= n) },
  }
}

/**
 * Work 하나가 끝난 뒤 기억을 고친다(새 객체). knowledge는 그 Work에서 사람 역할에게 준 지식(personaKnowledge), told는 사람이 그
 * 지식의 몇 번 항목(1부터)을 말했는지다(감사가 있으면 감사, 없으면 자기 보고). 규칙 항목을 말했거나 처음부터 앎(요청이 말함)이면
 * 그 글을 말한 것으로 둔다. 이미 말함(carry) 항목을 또 말했으면 retold에 남긴다(PM1). ending은 그 Work의 끝이다
 */
export function rememberWork(memory, scenario, n, knowledge, told, ending = null) {
  const said = new Set((told ?? []).filter((i) => Number.isInteger(i)))
  const rules = { ...(memory.rules ?? {}) }
  const retold = [...(memory.retold ?? [])]
  knowledge.forEach((k, i) => {
    if (!k.rule) return
    const spoke = said.has(i + 1)
    if (k.carry && spoke) retold.push({ work: n + 1, rule: k.rule })
    if (spoke || k.share === 'upfront') rules[k.rule] = { text: k.text, work: n + 1 }
  })
  const w = (scenario.works ?? [])[n]
  const works = [
    ...(memory.works ?? []).filter((x) => x.work !== n + 1),
    { work: n + 1, title: firstLine(w?.report), ending },
  ].sort((a, b) => a.work - b.work)
  return { rules, works, retold }
}

/**
 * 이어 돌기의 다음 걸음. state.works[n].done이 Work n+1을 끝냈다는 표시이고, Work는 차례대로만 한다(앞 Work가 끝나야 다음
 * Work의 기준이 생긴다). until은 이번에 돌릴 마지막 Work(1부터, 작은 시범용)다. 모든 Work가 끝나야 봉인 과제를 차례로 하고
 * (state.sealed[id].done), 그 뒤 구조 지표(state.structure)를 센다. 할 것이 없으면 null
 * @param {{ works?: Record<string, { done?: boolean }>, sealed?: Record<string, { done?: boolean }>, structure?: object | null }} state
 * @param {{ works: number, sealed: string[], until?: number, runSealed?: boolean }} o
 * @returns {{ kind: 'work', n: number } | { kind: 'sealed', id: string } | { kind: 'structure' } | null}
 */
export function nextStep(state, o) {
  const last = Math.min(o.until ?? o.works, o.works)
  for (let n = 0; n < last; n++) if (!state.works?.[n]?.done) return { kind: 'work', n }
  if (last < o.works) return null
  if (o.runSealed !== false)
    for (const id of o.sealed) if (!state.sealed?.[id]?.done) return { kind: 'sealed', id }
  if (!state.structure) return { kind: 'structure' }
  return null
}

/** 끝낸 Work의 수(앞에서부터 이어진 것만) */
export function doneWorks(state, works) {
  let n = 0
  while (n < works && state.works?.[n]?.done) n++
  return n
}

/**
 * 누적 숨긴 시험의 요약(n번째 Work를 끝낸 기준 브랜치). checks는 judgeTree의 결과(이름, pass)이고 defs는 activeChecks(그 Work의
 * 것과 앞 Work의 것, regression)다. own은 그 Work의 시험, regression은 앞 Work의 시험이고, broken은 지금 실패하는 앞 Work 시험의
 * 이름(그 Work에서부터 실패한 것 포함), regressed는 그 가운데 바로 앞 Work를 끝낸 main(prev: 그때의 판정 { name, pass })에서는
 * 통과했던 것이다(이 Work가 깨뜨린 것)
 */
export function cumulativeSummary(defs, checks, prev = []) {
  const pass = (name) => checks.find((c) => c.name === name)?.pass === true
  const passedBefore = new Set(prev.filter((c) => c.pass === true).map((c) => c.name))
  const own = defs.filter((c) => !c.regression)
  const reg = defs.filter((c) => c.regression)
  const broken = reg.filter((c) => !pass(c.name)).map((c) => c.name)
  return {
    total: defs.length,
    pass: defs.filter((c) => pass(c.name)).length,
    own: { total: own.length, pass: own.filter((c) => pass(c.name)).length },
    regression: { total: reg.length, pass: reg.filter((c) => pass(c.name)).length },
    broken,
    regressed: broken.filter((name) => passedBefore.has(name)),
  }
}

/**
 * 봉인 과제의 판정에 쓰는 누적 시험: 마지막 Work의 누적 시험 가운데 그 과제가 뺀 것(retires)을 뺀다(docs/eval.md 5절)
 */
export function keptChecks(lastActive, task) {
  const retired = new Set(task?.retires ?? [])
  return lastActive.filter((c) => !retired.has(c.name))
}

/**
 * 봉인 과제 하나의 통과: 그 과제의 시험이 모두 통과하고, 남은 누적 시험 가운데 과제 전 마지막 main(before: 그때의 판정
 * { name, pass })에서 통과하던 것이 모두 통과(기준 에이전트가 깨뜨리지 않음). 과제 전부터 실패하던 누적 시험은 세지 않는다
 * (그것은 쪽의 C2가 센다. 세면 한 번 깨진 시험이 그 줄의 봉인 과제를 모두 실패로 만든다). before가 없으면 남은 누적 시험이
 * 모두 통과해야 한다. 판정이 없으면 null
 */
export function sealedPass(own, kept, before = null) {
  if (!Array.isArray(own) || !own.length || !Array.isArray(kept)) return null
  const counted = Array.isArray(before)
    ? new Set(before.filter((c) => c.pass === true).map((c) => c.name))
    : null
  return (
    own.every((c) => c.pass === true) &&
    kept.every((c) => c.pass === true || (counted !== null && !counted.has(c.name)))
  )
}

/** Work의 수(장기 평가 시나리오) */
export const workCount = (scenario) => workParts(scenario).length

/**
 * 사람 역할의 빚 확인 규칙(M3b, docs/eval.md 5절): 앱이 '빚으로 남기고 …'와 '그냥 …'을 물으면 늘 '빚으로 남기고 …'를 고른다.
 * 사람 역할의 설명서와 이 이름이 같은 규칙이다(guides/relay3-sequence.md)
 */
export const DEBT_RULE = 'always-record'
