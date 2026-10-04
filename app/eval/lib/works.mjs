// Work 여럿을 잇는 시나리오. scenario.json의 works에 Work마다 report, knowledge, checks를 둔다.
// 레포, 선호, 기대 파일, 제한(Work마다)은 시나리오 하나가 같이 쓴다. works가 없는 시나리오는 Work 하나다.
// 지식 실험(docs/knowledge-experiment.md)에서 더한 것:
// - Work의 `teammate: true`: 그 Work는 팀의 다른 사람이 한다. 도구가 앞 Work들의 브랜치를 main에 머지하고(PR 머지와 같음),
//   레포를 새로 clone해 새 앱 저장소(relay)나 새 터미널(맨 CLI)에서 시작한다. 레포로 건너가지 않은 지식은 닿지 않는다.
// - knowledge 항목의 `carry: true`: 앞 Work에서 사람이 이미 알려 줬거나 알려 줄 수 있었던 사실이다. 사람 역할이 이것을
//   다시 알려 준 횟수(carriedTold)가 "다시 말하게 한 부담"이다.
// - 시나리오의 `measure`: 재는 Work의 번호(1부터). 없으면 첫 Work를 뺀 모두다.

/** Work 목록. works가 없으면 시나리오 자신이 Work 하나다 */
export function workParts(scenario) {
  if (!Array.isArray(scenario.works) || scenario.works.length === 0) {
    return [{ report: scenario.report, knowledge: scenario.knowledge, checks: scenario.checks }]
  }
  return scenario.works
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
    report: w.report,
    knowledge: w.knowledge ?? [],
    checks: w.checks ?? [],
    work: { index: n, count: parts.length, teammate: !!w.teammate, mates: mateIndex(parts, n) },
  }
}

/** n번째 Work를 하는 사람이 몇 번째 사람인지(0부터). teammate Work마다 사람이 바뀐다 */
export function mateIndex(parts, n) {
  return parts.slice(1, n + 1).filter((w) => w.teammate).length
}

/**
 * 판정의 짝. works가 있는 시나리오는 지식을 켠 relay 대 끈 relay(relay-off)이고, 나머지는 relay 대 맨 CLI다.
 * run.mjs의 --pairs로 바꿀 수 있다
 */
export function pairOf(scenario) {
  return multiWork(scenario) ? ['relay', 'relay-off'] : ['relay', 'cli']
}
