// Work 둘을 잇는 시나리오 (relay D319, I84). scenario.json의 works에 Work마다 report, knowledge, checks를 둔다.
// 레포, 선호, 기대 파일, 제한(Work마다)은 시나리오 하나가 같이 쓴다. works가 없는 시나리오는 Work 하나다.

/** Work 목록. works가 없으면 시나리오 자신이 Work 하나다 */
export function workParts(scenario) {
  if (!Array.isArray(scenario.works) || scenario.works.length === 0) {
    return [{ report: scenario.report, knowledge: scenario.knowledge, checks: scenario.checks }]
  }
  return scenario.works
}

export const multiWork = (scenario) => Array.isArray(scenario.works) && scenario.works.length > 0

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
    // Work마다 업무 유형을 바꿀 수 있다(버그 수정 → 기능 추가 등). 없으면 시나리오의 유형이다
    ...(w.type ? { type: w.type } : {}),
    report: w.report,
    knowledge: w.knowledge ?? [],
    checks: w.checks ?? [],
    work: { index: n, count: parts.length, teammate: !!w.teammate },
  }
}

/**
 * 판정의 짝. works가 있는 시나리오는 지식을 켠 relay 대 끈 relay(relay-off)이고, 나머지는 relay 대 맨 CLI다 (I84)
 */
export function pairOf(scenario) {
  return multiWork(scenario) ? ['relay', 'relay-off'] : ['relay', 'cli']
}
