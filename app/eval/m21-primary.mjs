#!/usr/bin/env node
// relay-v3 M2.1 평가(relay-v3 docs/m2.1-design.md 14절, 결과 전에 고정)의 주지표와 판정 규칙. m2-primary.mjs를 잇는다: 지표의
// 정의(P1~P5, G1·G2)와 구간(시나리오마다 층을 나눈 bootstrap 95%, primary.mjs compare)은 M2 규약 그대로다.
// 쪽은 relay3-m21(이 설계를 만든 빌드), relay3-m2p(M2 빌드 + 미룬 고침, 같은 날 도는 기준), relay@auto(v2 자율, P3 막대)다.
// 결론은 봉인 셋(H1 39-three-modules, H2, H3 09-stock-negative)에서만 낸다. 설계 셋(07, 14, 19, 40)은 기제만 보고한다. 거짓
// 자동은 규약의 표대로 relay3-m21의 14, H2, H3 실행에서 센다. G1·G2는 relay3-m21 모든 실행(온라인)이고, 실행의 내보내기가
// 모두 자동 조건을 채웠을 때만 그 실행을 센다(report.mjs autoRun, 3절). 장치마다의 지표는 run.json의 works[].devices
// (lib/relay3-devices.mjs)와 리뷰 사용량(lib/relay3-arm.mjs reviewUsage: 다시 쓴 리뷰와 멈춘 리뷰는 뺌)에서 센다. 오프라인
// 0단계(O1 관문 재생, O2 리뷰 재생)는 relay-v3 쪽 도구가 따로 낸다.
//   node eval/m21-primary.mjs <결과 폴더>... [--h2 <시나리오 id>] [--out 파일.md]
// M2 결과 폴더를 함께 주면 설계 셋의 쪽마다 평균에 M2의 relay3·relay@auto가 함께 보인다(기제 보고용, 판정에 쓰지 않음).
// 시범 결과 폴더(m21-pilot-*, 규약 9절 1)를 주면 읽기는 하되 보고서 머리와 stderr에 경고를 단다(시범은 판정에 넣지 않는다).
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { loadM2Runs, M2_METRICS, m2Compare, shadowPrecision, verdicts } from './m2-primary.mjs'
import { autoMet, autoRun, exportGates } from './report.mjs'
import { savedDevices } from './lib/relay3-devices.mjs'
import { isMain } from './lib/util.mjs'

export const M21 = 'relay3-m21'
export const M2P = 'relay3-m2p'
export const AUTO = 'relay@auto'

/** 봉인 H1: 모듈 셋(M2에 없음) */
export const H1 = '39-three-modules'
/**
 * 봉인 H2: 23의 Work 2를 한 Work로 둔 원인 둘의 시나리오. 다른 id로 만들었으면 --h2로 준다(m21Report의 o.h2)
 */
export const H2 = '47-double-notify-digest-w2'
/** 봉인 H3: 증상과 원인이 다른 모듈에 있는 시나리오 */
export const H3 = '09-stock-negative'
/** 설계 셋: 저장된 M2 값과 견줘 기제만 보고한다(결론에 쓰지 않음) */
export const DESIGN = ['07-two-bugs', '14-double-notify', '19-split-report', '40-three-libraries']
export const sealedOf = (h2 = H2) => [H1, h2, H3]
/** 거짓 자동을 세는 시나리오(14절 주지표 표: relay3-m21의 14, H2, H3) */
export const falseAutoScenariosOf = (h2 = H2) => ['14-double-notify', h2, H3]
/** 원인이 둘인 시나리오(V29의 최소 n: 14와 H2) */
export const twoCauseOf = (h2 = H2) => ['14-double-notify', h2]

/** 도구 문제로 끝난 실행은 빼고 따로 센다(M2 규약 4절). 시간·차례 제한과 포기는 실패로 센다 */
const TOOL_ERRORS = new Set(['harness_error', 'human_error'])

/** P1 m21 − m2p의 한계(14절): −10%포인트 */
export const P1_MARGIN = 0.1
/** P3 마찰 m21 − m2p의 한계(14절): 구간의 위 끝이 −2보다 아래 */
export const FRICTION_BOUND = -2
/** 판정 규칙 4: P5가 m2p보다 20% 넘게 늘면 */
export const P5_RISE = 0.2

/**
 * P1 m21 − m2p(14절): 95% 구간의 아래 끝이 −10%p보다 위면 '낮지 않음', 위 끝이 −10%p보다 아래면 '낮음', 그 밖은 '모름'
 */
export function p1Reading(c) {
  if (!c) return null
  if (c.lo > -P1_MARGIN) return '낮지 않음'
  if (c.hi < -P1_MARGIN) return '낮음'
  return '모름'
}

/** P3 마찰 m21 − m2p(14절): 구간의 위 끝이 −2보다 아래면 '줄었음'. 아니면 '줄었음 아님'(기대는 −3 이하) */
export function frictionReading(c) {
  if (!c) return null
  return c.hi < FRICTION_BOUND ? '줄었음' : '줄었음 아님'
}

/** 실행에 request_gap 올림이 있었나: 어느 리뷰에서든(이 Work에서 잰 묶음, 내보내기의 마지막 묶음) */
export function hadRequestGap(r) {
  return (r.works ?? []).some((w) => {
    const x = w.devices?.raises
    return (x?.requestGapBundles ?? 0) > 0 || (x?.exports ?? []).some((e) => e.requestGap > 0)
  })
}

/**
 * 거짓 자동(14절): 자동 조건을 채웠는데(실행의 내보내기 모두, autoRun) 숨긴 시험이 실패한 실행. partial은 내보내기 하나라도
 * 자동 조건을 채웠는데 실패한 실행이다(모두는 아니어서 거짓 자동으로 세지 않음, 참고). 실행마다 request_gap이 있었는지(판정
 * 규칙 3)와 자동 조건의 이름을 붙인다
 */
export function falseAutos(runs) {
  const judged = runs.filter((r) => typeof r.outcome?.success === 'boolean')
  const failed = judged.filter((r) => r.outcome.success === false)
  const row = (r) => ({
    scenario: r.scenario,
    index: r.index,
    requestGap: hadRequestGap(r),
    conditions: [
      ...new Set(
        exportGates(r)
          .filter(autoMet)
          .map((g) => g.condition ?? '?'),
      ),
    ],
  })
  return {
    runs: runs.length,
    judged: judged.length,
    auto: judged.filter(autoRun).length,
    wrong: failed.filter(autoRun).map(row),
    partial: failed.filter((r) => !autoRun(r) && exportGates(r).some(autoMet)).map(row),
  }
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const median = (xs) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * m2p의 P5 바탕: 두 쪽이 모두 돈 시나리오마다 m2p 평균을 내고 그 평균을 낸다(차이의 점 추정과 같은 무게). 규칙 4의 '20% 넘게'는
 * 차이의 점 추정을 이것으로 나눈 값이다
 */
export function p5Base(runs, a = M21, b = M2P) {
  const of = M2_METRICS.find((m) => m.key === 'P5').of
  const ids = [...new Set(runs.map((r) => r.scenario))]
  const vals = (arm, id) =>
    runs
      .filter((r) => r.arm === arm && r.scenario === id)
      .map(of)
      .filter((v) => typeof v === 'number')
  const means = ids
    .filter((id) => vals(a, id).length && vals(b, id).length)
    .map((id) => mean(vals(b, id)))
  return mean(means)
}

/**
 * 판정 규칙(14절)을 적용한다. cmp(a, b, key)는 봉인 셋에서 a − b의 m2Compare 결과(없으면 null), o.falseAuto는 falseAutos,
 * o.shadow는 relay3-m21의 shadowPrecision(autoRun), o.p5Base는 p5Base다. 규칙이 정하지 않은 경우는 그렇다고 적는다
 */
export function m21Verdicts(cmp, o = {}) {
  const out = {}
  // 규칙 1: P1 m21 − m2p
  const p1 = p1Reading(cmp(M21, M2P, 'P1'))
  if (!p1) out.P1 = '자료 없음'
  else if (p1 === '낮음')
    out.P1 =
      '낮음: 장치를 하나씩 되돌린다. 장치 지표가 가리키는 것부터, 기본 차례는 V24, V25, V23, V26. 되돌린 것은 다음 규약에서 잰다'
  else if (p1 === '모름') out.P1 = '모름: 그대로 두고 등록부에 모름으로 적는다'
  else out.P1 = '낮지 않음: 되돌리지 않는다'
  // 규칙 2: P3 마찰 m21 − m2p
  const fr = frictionReading(cmp(M21, M2P, 'P3'))
  if (!fr) out.P3 = '자료 없음'
  else if (fr === '줄었음') out.P3 = '줄었음(구간의 위 끝이 −2보다 아래)'
  else
    out.P3 =
      '줄었음이 아님: 장치별 지표로 어느 고침이 차례를 줄이지 못했는지 보고하고, 그 장치의 끄는 조건대로 처리한다(최소 n이 찬 것만, 규칙 5)'
  // P3 막대 m21 − relay@auto: M2 Q2의 규칙(δ 2, P1 δ 10%p) 그대로. M3로 갈지는 사용자와 정한다
  const bar = cmp(M21, AUTO, 'P3')
  const q2 = verdicts(
    (a, b, key) => (a === 'relay3' && b === 'relay@auto' ? cmp(M21, AUTO, key) : null),
    null,
  ).Q2
  out.bar = bar
    ? `P3 ${bar.reading}(δ 2). Q2 규칙으로 읽으면: ${q2}. M3로 갈지는 사용자와 정한다`
    : '자료 없음'
  // 규칙 3: 거짓 자동(14, H2, H3)
  const fa = o.falseAuto
  if (!fa || !fa.judged) out.falseAuto = '자료 없음'
  else if (fa.wrong.length === 0) out.falseAuto = '거짓 자동 0(목표)'
  else {
    const noGap = fa.wrong.filter((x) => !x.requestGap)
    const list = fa.wrong.map((x) => `${x.scenario}#${x.index}`).join(', ')
    out.falseAuto = noGap.length
      ? `거짓 자동 ${fa.wrong.length}회(${list}), 그 가운데 request_gap이 없던 실행 ${noGap.length}회: 그 결과를 V30의 끄는 조건 계산에 넣고, 줄 종류로 나눈 자동 조건을 사용자에게 올린다(16절)`
      : `거짓 자동 ${fa.wrong.length}회(${list}). 모두 request_gap이 있던 실행이라 규칙 3은 걸리지 않지만 목표 0을 채우지 못했다`
  }
  // 규칙 4: P5가 m2p보다 20% 넘게 늘고 P3가 줄지 않았으면 V23의 자동 리뷰 상한을 1로 내린다
  const p5 = cmp(M21, M2P, 'P5')
  if (!p5 || !(o.p5Base > 0)) out.P5 = '자료 없음'
  else {
    const rise = p5.diff / o.p5Base
    const text = `P5 ${rise >= 0 ? '+' : ''}${Math.round(rise * 100)}%`
    out.P5 =
      rise > P5_RISE && fr !== '줄었음'
        ? `${text}, P3 마찰 ${fr ?? '자료 없음'}: V23의 자동 리뷰(미리 리뷰) 상한을 1로 내린다`
        : `${text}, P3 마찰 ${fr ?? '자료 없음'}: 상한을 그대로 둔다`
  }
  // Q4: 온라인 G1(자동 조건을 채운 실행 10회 이상, 95%)
  out.Q4 = verdicts(() => null, o.shadow ?? null).Q4
  return out
}

const f = (x, d = 2) => (x === null || x === undefined ? '-' : Number(x).toFixed(d))
const pct = (a, n) => (n ? `${Math.round((100 * a) / n)}% (${a}/${n})` : '-')
const table = (head, rows) =>
  [
    `| ${head.join(' | ')} |`,
    `|${head.map(() => '---').join('|')}|`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n')
const tally = (obj) =>
  Object.entries(obj)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k} ${v}`)
    .join(', ') || '-'
const addTo = (acc, obj) => {
  for (const [k, v] of Object.entries(obj ?? {})) acc[k] = (acc[k] ?? 0) + (Number(v) || 0)
  return acc
}

const HOW = { once: '한 번', armed: '걸림', box: '상자' }

/** 되먹임의 결과(relay3-devices.mjs feedbackOutcomes)를 Work들에서 더한다. by는 relay나 human, key는 'facts.fixed' 같은 칸 */
function outcomeSum(works, by, key) {
  return works.reduce((a, w) => {
    const o = w.devices?.feedback?.outcomes?.[by]
    const v = key.split('.').reduce((x, k) => x?.[k], o)
    return a + (Number(v) || 0)
  }, 0)
}

/** '고쳐짐/(고쳐짐+남음) · …, 모름 n' */
function outcomeText(works, by) {
  const part = (kind) => {
    const fixed = outcomeSum(works, by, `${kind}.fixed`)
    const kept = outcomeSum(works, by, `${kind}.kept`)
    return pct(fixed, fixed + kept)
  }
  const unknown = outcomeSum(works, by, 'facts.unknown') + outcomeSum(works, by, 'findings.unknown')
  return `${part('facts')} · ${part('findings')}, 모름 ${unknown}`
}

/** 올림 규칙의 이름(relay3-devices.mjs RAISE_RULES): 그 빌드의 관문이 쓴 규칙 */
const RULE = { v26: 'V26 규칙', v4: 'V4 규칙(갈래가 있으면 올림)' }

/**
 * 장치 지표(14절 '장치마다 쓰는 지표', relay3-devices.mjs)를 실행 묶음 하나에서 센다. [이름, 값] 줄의 목록이다. M2.1에만 있는
 * 장치(끝내기, 되먹임, 기준 확인, 예시 자료, 단위, 통합 증거)는 M2.1 기록(devices.modern)에서만 세고, 옛 기록(M2, relay3-m2p)의
 * 칸은 '-'다. 올림과 메모는 옛 묶음에도 있어 모두 세고, 그 빌드의 관문이 쓴 규칙(M2.1은 V26, 옛 기록은 V4)으로 가른다. 값에
 * 규칙의 이름을 붙인다
 */
export function deviceRows(runs) {
  const works = runs.flatMap((r) => r.works ?? [])
  const known = works.filter((w) => w.devices)
  const dev = known.filter((w) => w.devices.modern !== false)
  const d = (fn) => dev.map((w) => fn(w.devices))
  const has = dev.length > 0
  const perRun = (fn) =>
    has ? f(mean(runs.map((r) => (r.works ?? []).reduce((a, w) => a + (fn(w) ?? 0), 0)))) : '-'
  const perWork = (fn) => (has ? f(mean(d(fn))) : '-')
  const end = (w) => w.devices?.end ?? {}
  const presses = dev.reduce((a, w) => a + (w.devices.end?.presses ?? 0), 0)
  const ready = dev.reduce((a, w) => a + (w.devices.end?.ready ?? 0), 0)
  const hows = {}
  for (const w of dev.filter((x) => x.ended)) {
    const k = HOW[w.devices.end?.how] ?? '기록 없음'
    hows[k] = (hows[k] ?? 0) + 1
  }
  const held = {}
  for (const w of dev) addTo(held, w.devices.feedback?.held)
  const probe = d((x) => x.probe ?? {})
  const probeCalls = probe.reduce((a, p) => a + (p.calls ?? 0), 0)
  const probeRan = probe.reduce((a, p) => a + (p.ran ?? 0), 0)
  const probeMs = probe.flatMap((p) => p.ms ?? [])
  const exportsReviewed = known.flatMap((w) =>
    (w.devices.raises?.exports ?? []).filter((x) => x.reviewed),
  )
  const byKind = {}
  const bySeverity = {}
  for (const x of exportsReviewed) {
    addTo(byKind, x.byKind)
    addTo(bySeverity, x.bySeverity)
  }
  // 규칙의 이름이 없는 예전 run.json의 장치 지표는 V26 규칙으로 센 것이다
  const rules = {}
  for (const w of known.filter((x) => (x.devices.raises?.exports ?? []).some((e) => e.reviewed))) {
    const k = RULE[w.devices.raises?.rule] ?? RULE.v26
    rules[k] = (rules[k] ?? 0) + 1
  }
  const ruleText = Object.keys(rules).length === 1 ? Object.keys(rules)[0] : tally(rules)
  const examplesWorks = dev.filter((w) => (w.devices.examples?.facts ?? 0) > 0).length
  // 통합 증거(V22): 단위 브랜치 전달 Work만. 그 칸이 없는 예전 결과는 세지 않는다
  const unitWorks = dev.filter(
    (w) => w.devices.delivery === 'branch_per_unit' && w.devices.integration,
  )
  const integ = (w) => w.devices.integration
  const lastKnown = unitWorks.filter((w) => typeof integ(w).lastOpen === 'boolean')
  const review = (w) => w.review ?? null
  const reviewTokens = (r) => {
    const u = r.agent?.review
    return u ? (u.input + u.cacheRead + u.cacheWrite) / 1000 : 0
  }
  const unmeasured = runs.filter((r) => Array.isArray(r.outcome?.unmeasuredBranches))
  return [
    ['실행', `${runs.length}`],
    ['Work 수/회', runs.length ? f(mean(runs.map((r) => (r.works ?? []).length))) : '-'],
    ['내보내기 수/Work (V22)', perWork((x) => x.exports ?? 1)],
    [
      '단위가 있는 계약 / 단위 브랜치 전달 (V21·V22)',
      has
        ? `${d((x) => x.units > 0).filter(Boolean).length} / ${d((x) => x.delivery === 'branch_per_unit').filter(Boolean).length} (Work ${dev.length})`
        : '-',
    ],
    ['끝낸 방식, Work (V25)', has ? tally(hows) : '-'],
    ['[끝내기] 누름/회', perRun((w) => end(w).presses)],
    ['누를 때 리뷰·증거가 끝나 있던 비율 (V23)', has ? pct(ready, presses) : '-'],
    [
      '걸린 끝/회 · 상자/회',
      has ? `${perRun((w) => end(w).armed)} · ${perRun((w) => end(w).boxes)}` : '-',
    ],
    [
      '[취소]·[더 고치기]/회 · 새 커밋으로 지움/회',
      has ? `${perRun((w) => end(w).cancelled)} · ${perRun((w) => end(w).moved)}` : '-',
    ],
    [
      '되먹임 라운드/Work: 모두 · 결정론 · 리뷰 (V24)',
      has
        ? `${perWork((x) => x.feedback?.rounds ?? 0)} · ${perWork((x) => x.feedback?.factRounds ?? 0)} · ${perWork((x) => x.feedback?.findingRounds ?? 0)}`
        : '-',
    ],
    [
      '되먹임으로 보낸 사실 · 지적 (합)',
      has
        ? `${d((x) => x.feedback?.facts ?? 0).reduce((a, b) => a + b, 0)} · ${d((x) => x.feedback?.findings ?? 0).reduce((a, b) => a + b, 0)}`
        : '-',
    ],
    [
      '보낸 사실이 고쳐짐 (relay: 결정론 · 리뷰, 다음 head를 모르는 것)',
      has ? outcomeText(dev, 'relay') : '-',
    ],
    ['되먹임 뒤 해로움이 난 라운드 (relay)', has ? `${outcomeSum(dev, 'relay', 'harmful')}` : '-'],
    ['[세션에 넘기기]/Work', perWork((x) => x.feedback?.passed ?? 0)],
    ['넘긴 지적이 고쳐짐 (human)', has ? outcomeText(dev, 'human') : '-'],
    ['되먹임을 보내지 않은 까닭 (합)', has ? tally(held) : '-'],
    ['기준 확인이 돈 제출 (V28)', has ? pct(probeRan, probeCalls) : '-'],
    [
      '기준 확인이 돌려보낸 제출 (합)',
      has ? `${probe.reduce((a, p) => a + (p.rejected ?? 0), 0)}` : '-',
    ],
    ['기준 확인 시간 중앙값(초)', probeMs.length ? f(median(probeMs) / 1000, 1) : '-'],
    [
      '예시 자료 사실이 난 Work (V27: 없음·다름·읽지 못함)',
      has
        ? `${pct(examplesWorks, dev.length)}; 묶음마다 없음 ${d((x) => x.examples?.absent ?? 0).reduce((a, b) => a + b, 0)}, 다름 ${d((x) => x.examples?.differs ?? 0).reduce((a, b) => a + b, 0)}`
        : '-',
    ],
    [
      '리뷰 호출/Work (다시 쓴 것·멈춘 것 뺌)',
      works.some(review) ? f(mean(works.map((w) => review(w)?.calls ?? 0))) : '-',
    ],
    [
      '미리 리뷰 · 다시 쓴 리뷰 · 멈춘 리뷰 /Work (V23)',
      works.some(review)
        ? ['prepared', 'reused', 'aborted']
            .map((k) => f(mean(works.map((w) => review(w)?.[k] ?? 0))))
            .join(' · ')
        : '-',
    ],
    ['리뷰 입력 토큰(천, 캐시 포함)/회', runs.length ? f(mean(runs.map(reviewTokens)), 1) : '-'],
    [
      '올림 · 메모 /리뷰한 내보내기 (그 빌드의 관문 규칙: M2.1 V26, M2·m2p V4)',
      exportsReviewed.length
        ? `${f(mean(exportsReviewed.map((x) => x.raised)))} · ${f(mean(exportsReviewed.map((x) => x.notes)))} (내보내기 ${exportsReviewed.length}, ${ruleText})`
        : '-',
    ],
    ['갈래별 올림 (합, 같은 규칙)', exportsReviewed.length ? tally(byKind) : '-'],
    ['심각도별 올림 (합, 같은 규칙)', exportsReviewed.length ? tally(bySeverity) : '-'],
    [
      'request_gap을 올린 실행 (V30)',
      exportsReviewed.length ? pct(runs.filter(hadRequestGap).length, runs.length) : '-',
    ],
    ['단위 브랜치 없음/회 (V22)', perRun((w) => w.devices?.missingExports ?? 0)],
    [
      '통합 증거 잰 수/단위 브랜치 Work (V22)',
      unitWorks.length
        ? `${f(mean(unitWorks.map((w) => integ(w).measures ?? 0)))} (Work ${unitWorks.length})`
        : '-',
    ],
    [
      '마지막 통합 증거에 열린 것이 있던 Work (V22)',
      unitWorks.length
        ? pct(lastKnown.filter((w) => integ(w).lastOpen).length, lastKnown.length)
        : '-',
    ],
    [
      '커밋이 Work 브랜치에 없는 단위 브랜치 (V22, 합 · 그런 Work)',
      unitWorks.length
        ? `${unitWorks.reduce((a, w) => a + (integ(w).notOnWorkBranch ?? 0), 0)} · ${pct(unitWorks.filter((w) => (integ(w).notOnWorkBranch ?? 0) > 0).length, unitWorks.length)}`
        : '-',
    ],
    [
      '재지 않은 브랜치/회 (V21)',
      unmeasured.length ? f(mean(unmeasured.map((r) => r.outcome.unmeasuredBranches.length))) : '-',
    ],
  ]
}

/** 상자 없이 끝낸 방식(V25): 바로 끝남(once)과 걸렸다가 리뷰 뒤 저절로 끝남(armed). box는 상자의 [그래도 끝내기]다 */
export const NO_BOX = ['once', 'armed']

/**
 * 실행의 끝낸 방식(V25 끄는 조건의 P1 견줌): 끝난 Work 가운데 하나라도 상자에서 끝냈으면 box, 모두 상자 없이(once, armed)
 * 끝났으면 no_box. 끝난 Work가 없거나 끝낸 방식의 기록이 없는 Work가 있으면 null
 */
export function runHow(r) {
  const hows = (r.works ?? []).filter((w) => w.ended).map((w) => w.devices?.end?.how ?? null)
  if (!hows.length || hows.some((h) => h !== 'box' && !NO_BOX.includes(h))) return null
  return hows.includes('box') ? 'box' : 'no_box'
}

/**
 * 봉인 셋 실행의 리뷰 호출(V23 끄는 조건): Work당과 내보내기당. 리뷰 호출은 다시 쓴 리뷰와 멈춘 리뷰를 뺀 것이다(relay3-arm.mjs
 * reviewUsage). 내보내기는 Work의 내보내기 수(장치 지표가 없거나 옛 기록이면 1)다. one_branch Work는 내보내기가 하나라 내보내기당이
 * 곧 Work당이고, 단위 브랜치 Work는 내보내기당이라 규약의 'Work당 리뷰 수(단위 브랜치 Work는 내보내기당)'가 내보내기당 값이다
 */
export function reviewCalls(runs, h2 = H2) {
  const sealed = sealedOf(h2)
  const rs = runs.filter((r) => sealed.includes(r.scenario))
  const works = rs.flatMap((r) => r.works ?? [])
  const calls = works.reduce((a, w) => a + (Number(w.review?.calls) || 0), 0)
  const exports = works.reduce((a, w) => a + (Number(w.devices?.exports) || 1), 0)
  return {
    runs: rs.length,
    works: works.length,
    perWork: works.length ? calls / works.length : null,
    perExport: exports ? calls / exports : null,
  }
}

/** V23 끄는 조건의 배수: m21의 내보내기당 리뷰 호출이 기준(m2p)의 이것을 넘으면 */
export const REVIEW_RATIO = 2

/**
 * 장치의 최소 n과 끄는 조건(판정 규칙 5: 끄는 조건은 최소 n이 찬 뒤에만 쓴다. 차지 않으면 '모름'). relay3-m21 실행에서 센다.
 * 앱이 세지 않고 사람이나 AI가 판정해야 하는 값(보낸 사실이 고쳐졌는가, 원인을 다 담은 계약, 바로잡은 일, [끝내기] 뒤 순수
 * 기다림)은 여기서 재지 않고 그렇다고 적는다. cmp는 봉인 셋의 m2Compare다(V24의 P2 조건). base는 V23의 기준인 relay3-m2p
 * 실행이다(봉인 셋에서 견줌)
 * @param {object[]} runs relay3-m21 실행
 * @param {(a: string, b: string, key: string) => object | null} cmp
 * @param {string} [h2]
 * @param {object[]} [base] relay3-m2p 실행
 */
export function minNRows(runs, cmp, h2 = H2, base = []) {
  const works = runs.flatMap((r) => r.works ?? [])
  const dev = works.filter((w) => w.devices)
  const sum = (fn) => dev.reduce((a, w) => a + (fn(w.devices) ?? 0), 0)
  const state = (n, min) => (n >= min ? '찼음' : '모름(n 모자람)')
  const noBox = dev.filter((w) => w.ended && NO_BOX.includes(w.devices.end?.how)).length
  const p1Of = (how) => {
    const rs = runs.filter((r) => runHow(r) === how && typeof r.outcome?.success === 'boolean')
    return rs.length ? rs.filter((r) => r.outcome.success).length / rs.length : null
  }
  const probeCalls = sum((x) => x.probe?.calls)
  const probeRan = sum((x) => x.probe?.ran)
  const probeMs = dev.flatMap((w) => w.devices.probe?.ms ?? [])
  const ranRate = probeCalls ? probeRan / probeCalls : null
  const delay = probeMs.length ? median(probeMs) / 60000 : null
  const facts = sum((x) => x.feedback?.facts)
  const findings = sum((x) => x.feedback?.findings)
  const p2 = cmp(M21, M2P, 'P2')
  const twoCause = runs.filter((r) => twoCauseOf(h2).includes(r.scenario)).length
  const passedExports = runs
    .filter((r) => r.outcome?.success === true)
    .flatMap((r) => (r.works ?? []).flatMap((w) => w.devices?.raises?.exports ?? []))
    .filter((x) => x.reviewed)
  const falseRaise = passedExports.filter((x) => x.requestGap > 0).length
  const reviewedExports = dev.flatMap((w) =>
    (w.devices.raises?.exports ?? []).filter((x) => x.reviewed),
  )
  // V23: 봉인 셋에서 m21과 기준(m2p)의 리뷰 호출. 최소 n은 봉인 시나리오마다 두 쪽 5회
  const sealed = sealedOf(h2)
  const own = reviewCalls(runs, h2)
  const before = reviewCalls(base, h2)
  const fiveEach = sealed.every(
    (id) =>
      runs.filter((r) => r.scenario === id).length >= 5 &&
      base.filter((r) => r.scenario === id).length >= 5,
  )
  const ratio =
    before.perExport > 0 && own.perExport !== null ? own.perExport / before.perExport : null
  const ratioText =
    ratio === null
      ? '배수 모름(기준 없음)'
      : ratio > REVIEW_RATIO
        ? `${f(ratio)}배: ${REVIEW_RATIO}배를 넘음. [끝내기] 뒤 순수 기다림이 반으로 줄지 않았으면 PR과 [끝내기] 계기로 돌아간다`
        : `${f(ratio)}배: ${REVIEW_RATIO}배를 넘지 않아 끄지 않는다`
  return [
    [
      'V25 한 번 끝',
      '상자 없이 끝낸 Work(한 번·걸림)',
      `${noBox}`,
      '30',
      state(noBox, 30),
      `P1 상자 없이 ${f(p1Of('no_box'))}, 상자 ${f(p1Of('box'))}(상자 없이가 δ 10%p 넘게 낮으면 두 단계로). 끝낸 뒤 바로잡은 일은 사람이 센다`,
    ],
    [
      'V23 미리 리뷰(계기)',
      `봉인 셋 실행(${M21} · 기준 ${M2P})`,
      `${own.runs} · ${before.runs}`,
      '시나리오마다 5 · 5',
      fiveEach ? '찼음' : '모름(n 모자람)',
      `리뷰 호출/Work ${f(own.perWork)} · ${f(before.perWork)}, /내보내기 ${f(own.perExport)} · ${f(before.perExport)}(${ratioText}). [끝내기] 뒤 순수 기다림: 분류에서(5.4 P3 갈래)`,
    ],
    [
      'V24 되먹임(결정론)',
      '보낸 사실',
      `${facts}`,
      '30',
      state(facts, 30),
      `고쳐짐 ${pct(outcomeSum(dev, 'relay', 'facts.fixed'), outcomeSum(dev, 'relay', 'facts.fixed') + outcomeSum(dev, 'relay', 'facts.kept'))}(50% 아래면 [세션에 넘기기]만), 해로움이 난 라운드 ${outcomeSum(dev, 'relay', 'harmful')}. 까닭을 대고 넘김과 끼어듦은 사람·AI가 판정한다`,
    ],
    [
      'V24 되먹임(리뷰)',
      '보낸 지적',
      `${findings}`,
      '30',
      state(findings, 30),
      `고쳐짐 ${pct(outcomeSum(dev, 'relay', 'findings.fixed'), outcomeSum(dev, 'relay', 'findings.fixed') + outcomeSum(dev, 'relay', 'findings.kept'))}(다음 리뷰가 같은 글로 다시 올리지 않음, 후함). ${
        p2
          ? `P2 m21 − m2p ${f(p2.diff)} [${f(p2.lo)}, ${f(p2.hi)}]${p2.hi < 0 ? ': 구간 밖으로 낮음, 리뷰 종류를 끈다(n이 찼을 때)' : ''}`
          : 'P2 자료 없음'
      }`,
    ],
    [
      'V28 제출 때 기준 확인',
      'Work',
      `${dev.length}`,
      '30',
      state(dev.length, 30),
      `확인이 돈 제출 ${ranRate === null ? '-' : `${Math.round(ranRate * 100)}%`}(20% 아래면 뺌), 지연 중앙값 ${delay === null ? '-' : `${f(delay, 1)}분`}(2분 넘으면 뺌). 승인 뒤 기준 까닭의 바꾸기는 사람이 센다`,
    ],
    [
      'V29 계약이 요청을 설명',
      `원인 둘 실행(14, ${h2})`,
      `${twoCause}`,
      '10',
      state(twoCause, 10),
      '모든 원인을 담은 계약은 참조 패치와 견줘 AI가 판정한다(3회 아래면 뺌)',
    ],
    [
      'V30 리뷰의 요청 대조',
      '숨긴 시험을 통과한 리뷰한 내보내기',
      `${passedExports.length}`,
      '30',
      state(passedExports.length, 30),
      `거짓 올림 ${pct(falseRaise, passedExports.length)}(15% 넘으면 메모로). 잡음은 run.json에서 세지 못한다(관문의 까닭을 남기지 않음): 배치 뒤 M2.1 묶음(m2.1.jsonl)을 request_gap을 메모로 두고 관문 재생해 잰다. 오프라인은 O2`,
    ],
    [
      'V26 올림 기준',
      '리뷰한 내보내기(V31 재생과 합침)',
      `${reviewedExports.length}`,
      '30',
      state(reviewedExports.length, 30),
      '구조/low 하나만 막을 수 있었던 실패는 V31 재생과 함께 본다',
    ],
  ]
}

/**
 * 여러 결과 폴더의 실행(loadM2Runs: 쪽 이름과 P2). run.json에 장치 지표가 없는 relay-v3 Work(예전 결과)는 결과 폴더에 남긴
 * Work 폴더에서 다시 센다(relay3-devices.mjs savedDevices)
 */
export function loadM21Runs(dirs) {
  return loadM2Runs(dirs).map((r) =>
    r.works?.some((w) => !w.devices && r.dir)
      ? {
          ...r,
          works: r.works.map((w) =>
            w.devices || !w.id
              ? w
              : { ...w, devices: savedDevices(path.join(r.dir, 'works', w.id)) ?? undefined },
          ),
        }
      : r,
  )
}

/** 시범 결과 폴더의 이름(규약 9절 1: m21-pilot-*). 시범은 판정에 넣지 않는다 */
export const PILOT = /^m21-pilot-/

/** 결과 폴더 가운데 시범 폴더(경로의 어느 마디가 m21-pilot-로 시작) */
export const pilotDirs = (dirs = []) =>
  dirs.filter((d) =>
    path
      .resolve(d)
      .split(path.sep)
      .some((x) => PILOT.test(x)),
  )

/** 시나리오의 묶음: 봉인, 설계, 그 밖 */
const groupOf = (id, h2) =>
  sealedOf(h2).includes(id) ? '봉인' : DESIGN.includes(id) ? '설계(기제만)' : '그 밖'

/**
 * 보고서. runs는 loadM2Runs의 결과다
 * @param {object[]} runs
 * @param {{ dirs?: string[], h2?: string }} [o]
 */
export function m21Report(runs, o = {}) {
  const h2 = o.h2 ?? H2
  const sealed = sealedOf(h2)
  const excluded = runs.filter((r) => TOOL_ERRORS.has(r.ending))
  const ok = runs.filter((r) => !excluded.includes(r))
  const ORDER = [M21, M2P, AUTO, 'relay3', 'relay3-noreview', 'cli']
  const arms = [
    ...ORDER.filter((a) => ok.some((r) => r.arm === a)),
    ...[...new Set(ok.map((r) => r.arm))].filter((a) => !ORDER.includes(a)).sort(),
  ]
  const GROUPS = ['봉인', '설계(기제만)', '그 밖']
  const ids = [...new Set(ok.map((r) => r.scenario))].sort(
    (a, b) => GROUPS.indexOf(groupOf(a, h2)) - GROUPS.indexOf(groupOf(b, h2)) || a.localeCompare(b),
  )
  const pilots = pilotDirs(o.dirs)
  const lines = [
    '# M2.1 평가 주지표 (relay-v3 docs/m2.1-design.md 14절)',
    '',
    ...(pilots.length
      ? [
          `> 경고: 시범 결과 폴더(m21-pilot-*)가 들어 있다: ${pilots.map((d) => `\`${d}\``).join(', ')}. 시범은 판정에 넣지 않는다(규약 9절 1). 이 보고서의 판정을 쓰지 말고 배치 폴더만 주어 다시 모은다`,
          '',
        ]
      : []),
    ...(o.dirs?.length ? [`- 결과 폴더: ${o.dirs.map((d) => `\`${d}\``).join(', ')}`] : []),
    `- 실행 ${runs.length}개, 도구 문제로 뺀 실행 ${excluded.length}개${excluded.length ? ` (${excluded.map((r) => `${r.scenario} ${r.arm}#${r.index} ${r.ending}`).join(', ')})` : ''}`,
    `- 숨긴 시험을 판정하지 못한 실행(P1에서 뺌): ${ok.filter((r) => typeof r.outcome?.success !== 'boolean').length}개`,
    `- 봉인 셋(결론): ${sealed.join(', ')}. 설계 셋(기제만): ${DESIGN.join(', ')}`,
    `- 봉인 셋 가운데 실행이 없는 시나리오: ${sealed.filter((id) => !ok.some((r) => r.scenario === id)).join(', ') || '없음'}`,
    '- 구간은 시나리오마다 층을 나눈 bootstrap 95%(10,000번, 씨앗 고정). P1 −10%포인트, P3 마찰 −2, P3 막대 δ 2',
    '- G1·G2와 거짓 자동은 실행의 내보내기가 모두 자동 조건을 채운 실행만 센다(V22). 리뷰 호출과 토큰은 다시 쓴 리뷰와 멈춘 리뷰를 뺀다(V23)',
    '',
    '## 쪽마다 평균 (시나리오별, 괄호는 n)',
    '',
  ]
  const rows = []
  for (const m of M2_METRICS)
    for (const id of ids) {
      const cells = arms.map((a) => {
        const v = ok
          .filter((r) => r.arm === a && r.scenario === id)
          .map((r) => m.of(r))
          .filter((x) => x !== null && x !== undefined)
        return v.length ? `${f(mean(v))} (${v.length})` : '-'
      })
      if (cells.some((c) => c !== '-')) rows.push([m.name, id, groupOf(id, h2), ...cells])
    }
  lines.push(rows.length ? table(['지표', '시나리오', '묶음', ...arms], rows) : '(실행이 없다)', '')

  // 주지표: 봉인 셋에서만
  const sealedRuns = ok.filter((r) => sealed.includes(r.scenario))
  const results = new Map()
  const cmp = (a, b, key) => {
    const k = `${a}|${b}|${key}`
    if (!results.has(k))
      results.set(
        k,
        m2Compare(
          sealedRuns,
          a,
          b,
          M2_METRICS.find((x) => x.key === key),
        ),
      )
    return results.get(k)
  }
  const READ = {
    P1: (c, a, b) => (b === M2P ? p1Reading(c) : c.reading),
    P3: (c, a, b) => (b === M2P ? frictionReading(c) : `${c.reading}(δ 2, 막대)`),
  }
  const crows = []
  for (const [a, b] of [
    [M21, M2P],
    [M21, AUTO],
  ])
    for (const m of M2_METRICS) {
      const c = cmp(a, b, m.key)
      if (!c) continue
      const read = READ[m.key]?.(c, a, b) ?? c.reading
      crows.push([
        `${a} − ${b}`,
        m.name,
        `${c.scenarios}`,
        f(c.diff),
        `[${f(c.lo)}, ${f(c.hi)}]`,
        read,
      ])
    }
  const base = p5Base(sealedRuns)
  lines.push(
    '## 주지표 (봉인 셋)',
    '',
    crows.length
      ? table(['짝', '지표', '시나리오 수', '차이', '95% 구간', '읽기'], crows)
      : '(견줄 짝이 없다)',
    '',
    `- P1(m21 − m2p): 아래 끝이 −10%p보다 위면 낮지 않음, 위 끝이 −10%p보다 아래면 낮음. P3 마찰(m21 − m2p): 위 끝이 −2보다 아래면 줄었음. P3 막대(m21 − relay@auto): M2 Q2의 δ 2`,
    `- P5 바탕(m2p 시나리오 평균의 평균, 천): ${f(base, 1)}`,
    '',
  )

  // 거짓 자동: relay3-m21의 14, H2, H3
  const m21 = ok.filter((r) => r.arm === M21)
  const fa = falseAutos(m21.filter((r) => falseAutoScenariosOf(h2).includes(r.scenario)))
  const faRow = (x) =>
    `${x.scenario}#${x.index} (조건 ${x.conditions.join(', ') || '-'}, request_gap ${x.requestGap ? '있음' : '없음'})`
  lines.push(
    `## 거짓 자동 (relay3-m21, ${falseAutoScenariosOf(h2).join(', ')})`,
    '',
    table(
      ['지표', '값'],
      [
        ['판정한 실행', `${fa.judged}/${fa.runs}`],
        ['자동 조건을 채운 실행(내보내기 모두)', `${fa.auto}`],
        ['거짓 자동(그 가운데 숨긴 시험 실패, 목표 0)', `${fa.wrong.length}`],
        ['거짓 자동 실행', fa.wrong.map(faRow).join('; ') || '-'],
        [
          '내보내기 일부만 자동 조건을 채운 실패 실행(참고)',
          fa.partial.map(faRow).join('; ') || '-',
        ],
      ],
    ),
    '',
  )

  // G1·G2 온라인: relay3-m21 모든 실행
  const g = shadowPrecision(m21, autoRun)
  const gRow = (name, x) => [
    name,
    pct(x.exported, x.judged),
    `${x.auto}`,
    pct(x.g1Pass, x.auto),
    x.pass ? `${f(x.g2 * 100, 0)}% (${x.pass})` : '-',
  ]
  const grows = [gRow(`${M21} 모두`, g)]
  for (const grp of GROUPS) {
    const rs = m21.filter((r) => groupOf(r.scenario, h2) === grp)
    if (rs.length) grows.push(gRow(`${M21} ${grp}`, shadowPrecision(rs, autoRun)))
  }
  const m2pRuns = ok.filter((r) => r.arm === M2P)
  if (m2pRuns.length) grows.push(gRow(`${M2P}(참고)`, shadowPrecision(m2pRuns, autoRun)))
  lines.push(
    '## G1·G2 (온라인. 오프라인 O1·O2는 따로)',
    '',
    table(
      [
        '실행',
        '내보내기 결론이 있음(판정한 실행 가운데)',
        '자동 조건을 채움(내보내기 모두)',
        'G1 그 가운데 숨긴 시험 모두 통과',
        'G2 통과 가운데 자동 조건(통과 실행 수)',
      ],
      grows,
    ),
    '',
  )

  // 장치 지표: relay-v3 쪽 × 묶음
  const devArms = arms.filter((a) => a.startsWith('relay3'))
  const cols = []
  for (const a of devArms)
    for (const grp of GROUPS) {
      const rs = ok.filter((r) => r.arm === a && groupOf(r.scenario, h2) === grp)
      if (rs.length) cols.push({ name: `${a} · ${grp}`, rows: deviceRows(rs) })
    }
  if (cols.length) {
    const names = cols[0].rows.map(([n]) => n)
    lines.push(
      '## 장치 지표 (events.jsonl과 증거 묶음)',
      '',
      table(
        ['지표', ...cols.map((c) => c.name)],
        names.map((n, i) => [n, ...cols.map((c) => c.rows[i][1])]),
      ),
      '',
    )
  }

  lines.push(
    '## 최소 n과 끄는 조건 (판정 규칙 5, relay3-m21)',
    '',
    table(
      ['장치', '센 것', 'n', '최소 n', '상태', '값'],
      minNRows(
        m21,
        cmp,
        h2,
        ok.filter((r) => r.arm === M2P),
      ),
    ),
    '',
  )

  // 실행 점검: 품질 기준 덧씌우기(모든 쪽), 번호 빠진 스크린샷, main을 움직인 실행
  const checks = arms.map((a) => {
    const own = ok.filter((r) => r.arm === a)
    return [
      a,
      `${own.length}`,
      own.some((r) => r.screenshots)
        ? `${own.reduce((s, r) => s + (r.screenshots?.unmarked ?? 0), 0)}`
        : '-',
      own.some((r) => r.outcome && 'mainMoved' in r.outcome)
        ? `${own.filter((r) => r.outcome?.mainMoved).length}`
        : '-',
      `${own.filter((r) => !r.options?.qualityOverlay).length}`,
    ]
  })
  lines.push(
    '## 실행 점검',
    '',
    table(
      ['쪽', '실행', '번호 빠진 스크린샷', 'main이 움직인 실행', '품질 기준 덧씌우지 않은 실행'],
      checks,
    ),
    '',
  )

  const v = m21Verdicts(cmp, { falseAuto: fa, shadow: g, p5Base: base })
  lines.push(
    '## 판정 규칙 (14절, 결론은 봉인 셋)',
    '',
    `- 1 (P1 m21 − m2p): ${v.P1}`,
    `- 2 (P3 마찰 m21 − m2p): ${v.P3}`,
    `- P3 막대 (m21 − relay@auto): ${v.bar}`,
    `- 3 (거짓 자동): ${v.falseAuto}`,
    `- 4 (P5): ${v.P5}`,
    `- G1 (Q4 규칙, 온라인): ${v.Q4}`,
    '- 5 (장치의 끄는 조건): 위 최소 n 표에서 찬 것만 쓴다. 차지 않은 장치는 모름으로 둔다',
    '',
  )
  return {
    text: lines.join('\n'),
    pilots,
    verdicts: v,
    falseAuto: fa,
    shadow: g,
    comparisons: Object.fromEntries(results),
  }
}

if (isMain(import.meta.url)) {
  const { values: v, positionals } = parseArgs({
    allowPositionals: true,
    options: { out: { type: 'string' }, h2: { type: 'string' } },
  })
  if (!positionals.length) {
    console.error(
      '쓰는 법: node eval/m21-primary.mjs <결과 폴더>... [--h2 <시나리오 id>] [--out 파일.md]',
    )
    process.exit(2)
  }
  const { text, pilots } = m21Report(loadM21Runs(positionals), { dirs: positionals, h2: v.h2 })
  if (pilots.length)
    console.error(`경고: 시범 결과 폴더가 들어 있다(판정에 쓰지 않는다): ${pilots.join(', ')}`)
  if (v.out) fs.writeFileSync(v.out, text)
  console.log(text)
}
