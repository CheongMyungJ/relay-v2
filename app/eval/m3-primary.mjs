#!/usr/bin/env node
// relay-v3 M3 장기 평가(docs/m3-design.md 6절 '주지표: 봉인 과제 통과율, 뒤 Work 비용, 누적 숨긴 시험 통과, 다시 말하기. 구조
// 지표는 보조')의 집계. run-sequence.mjs의 결과 폴더(여럿)에서 줄(쪽 × 회차)마다 run.json(lib/sequence-run.mjs composeRun)을
// 읽는다. 분석 단위는 줄 하나다(Work 15개와 봉인 과제 셋이 한 줄의 값 하나가 된다). 쪽마다 평균을 내고, 두 쪽의 차이는
// m2-primary·m21-primary와 같은 구간(primary.mjs compare: 시나리오마다 층을 나눈 bootstrap 95%, 10,000번, 씨앗 고정)과 같은
// 동등 판정(m2-primary equivalence: ±δ 안이면 같음, 구간이 δ 밖이면 다름, 걸치면 모름. δ가 없는 지표는 0을 넘는지)으로 읽는다.
// 시나리오가 하나(48)라 층은 하나이고 쪽마다 n=3이면 작은 차이는 '모름'으로 나오기 쉽다(m3-design 머리의 사용자 결정).
// δ는 규약에서 결과 전에 고정한다. 여기 값(M3_METRICS)은 제안이다. n=3에서 percentile bootstrap은 구간이 너무 좁다(같은 분포에서
// 뽑아도 95% 구간이 0을 비키는 일이 약 20%). 그래서 줄 셋 대 셋의 정확한 순열 p(20가지 나눔, 가장 작은 양쪽 p = 0.1)를 함께
// 보이고, 규칙에 드는 '좋음'·'나쁨'은 구간과 순열 p가 함께 맞을 때만이다(decides 지표만. relay-v3 docs/experiments/m3/protocol.md 6절).
//   node eval/m3-primary.mjs <결과 폴더>... [--out 파일.md]
// 봉인: 봉인 과제는 id(s1 등)와 통과 수만, 누적 시험은 id(w01-1 등)만 보인다.
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { equivalence } from './m2-primary.mjs'
import { compare } from './primary.mjs'
import { loadScenario } from './report.mjs'
import { sealedTasks } from './lib/sequence-run.mjs'
import { isMain, readJson } from './lib/util.mjs'
import { workParts } from './lib/works.mjs'

export const RELAY3 = 'relay3'
export const RELAY3_M2 = 'relay3-m2'
export const CLI = 'cli'
export const ARMS = [RELAY3, RELAY3_M2, CLI]

/** 견주는 짝 [a, b] = a − b. 첫 짝이 M3 장치를 켤지 정하는 짝이다(m3-design 1절 '켠 쪽과 끈 쪽을 견준다') */
export const M3_PAIRS = [
  [RELAY3, RELAY3_M2],
  [RELAY3, CLI],
  [RELAY3_M2, CLI],
]

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const num = (x) => typeof x === 'number' && Number.isFinite(x)
const inputK = (a) =>
  a && num(a.input) ? (a.input + (a.cacheRead ?? 0) + (a.cacheWrite ?? 0)) / 1000 : null

/** 봉인 과제가 모두 판정된 줄의 과제들(아니면 null) */
const sealedOf = (r) =>
  r.sealedComplete && r.sealed.every((s) => typeof s.pass === 'boolean') ? r.sealed : null
/** Work마다의 누적 시험 통과 비율 */
const cumRates = (r) =>
  (r.works ?? [])
    .map((w) => (w.cumulative?.total ? w.cumulative.pass / w.cumulative.total : null))
    .filter(num)
/** 다시 말한 수: 감사(carriedToldAudit)가 있으면 그것, 없으면 자기 보고(carriedTold) */
export const retellsOf = (w) => w.human?.carriedToldAudit ?? w.human?.carriedTold ?? 0

/** 순열 p가 이것 이하여야 '좋음'·'나쁨'이 규칙에 든다(3 대 3에서 가장 작은 양쪽 p) */
export const PERM_ALPHA = 0.1

/**
 * 지표. primary는 주지표(6절), decides는 묶음의 판정 규칙에 드는 지표(나머지는 보고만이거나 장치의 끄는 조건에만), better는
 * 좋은 방향, delta는 동등 한계 δ(제안, 규약에서 고정), bounds는 값이 놓일 수 있는 끝(천장·바닥 읽기). of(줄)이 null이면 그 줄은
 * 빠진다
 */
export const M3_METRICS = [
  {
    key: 'S1',
    name: '봉인 과제 통과율',
    primary: true,
    decides: true,
    bounds: [0, 1],
    better: 1,
    delta: 0.1,
    of: (r) => {
      const s = sealedOf(r)
      return s ? s.filter((x) => x.pass).length / s.length : null
    },
  },
  {
    key: 'S2',
    name: '봉인 과제 기준 에이전트 입력 토큰(천, 캐시 포함, 과제 평균)',
    primary: true,
    better: -1,
    delta: null,
    of: (r) => {
      const s = sealedOf(r)
      const v = s?.map((x) => inputK(x.agent)).filter(num) ?? []
      return s && v.length === s.length ? mean(v) : null
    },
  },
  {
    key: 'S3',
    name: '봉인 과제 걸린 시간(분, 과제 평균)',
    primary: true,
    better: -1,
    delta: null,
    of: (r) => {
      const s = sealedOf(r)
      return s ? mean(s.map((x) => (x.wallMs ?? 0) / 60000)) : null
    },
  },
  {
    key: 'C1',
    name: '누적 숨긴 시험 통과(Work마다 비율의 평균)',
    primary: true,
    decides: true,
    bounds: [0, 1],
    better: 1,
    delta: 0.1,
    of: (r) => (r.worksComplete ? mean(cumRates(r)) : null),
  },
  {
    key: 'C2',
    name: '마지막 Work 뒤 누적 숨긴 시험 통과 비율',
    primary: true,
    decides: true,
    bounds: [0, 1],
    better: 1,
    delta: 0.1,
    of: (r) => (r.worksComplete ? (cumRates(r).at(-1) ?? null) : null),
  },
  {
    key: 'PM1',
    name: '다시 말하기(열 전체에서 이미 말한 규칙을 다시 말한 수)',
    primary: true,
    decides: true,
    bounds: [0, null],
    better: -1,
    delta: 1,
    of: (r) => (r.worksComplete ? r.works.reduce((a, w) => a + retellsOf(w), 0) : null),
  },
  {
    key: 'C3',
    name: '앞 Work에서 통과했는데 뒤 Work가 깨뜨린 숨긴 시험 수(열 전체)',
    better: -1,
    delta: null,
    of: (r) =>
      r.worksComplete
        ? r.works.reduce((a, w) => a + (w.cumulative?.regressed?.length ?? 0), 0)
        : null,
  },
  {
    key: 'T1',
    name: '가장 긴 파일 줄 수(마지막 레포)',
    better: -1,
    delta: 50,
    of: (r) => r.structure?.final?.longest?.lines ?? null,
  },
  {
    key: 'T2',
    name: '상한(600줄)을 넘는 파일 수',
    better: -1,
    delta: 1,
    bounds: [0, null],
    of: (r) => r.structure?.final?.over?.count ?? null,
  },
  {
    key: 'T3',
    name: '중복 줄 비율(6줄 창, src)',
    better: -1,
    delta: 0.01,
    bounds: [0, 1],
    of: (r) => r.structure?.final?.duplication?.ratio ?? null,
  },
  {
    key: 'T4',
    name: '두 파일 이상에 정의된 같은 이름의 함수 수(src)',
    better: -1,
    delta: 1,
    bounds: [0, null],
    of: (r) => r.structure?.final?.definitions?.count ?? null,
  },
  {
    key: 'W1',
    name: 'Work당 에이전트 입력 토큰(천, 캐시 포함, 앱이 부른 claude -p 포함)',
    better: -1,
    delta: null,
    of: (r) => (r.worksComplete ? mean(r.works.map((w) => inputK(w.agent)).filter(num)) : null),
  },
  {
    key: 'W2',
    name: 'Work당 사람 차례',
    better: -1,
    delta: null,
    of: (r) => (r.worksComplete ? mean(r.works.map((w) => w.human?.turns).filter(num)) : null),
  },
]

/**
 * 결과 폴더들의 줄. 줄마다 run.json(없으면 state.json과 work-NN/sequence.json으로 모은 것)에 쪽(arm), 다 했는지
 * (worksComplete: Work 15개 모두, sealedComplete: 봉인 과제 모두), 도구 문제로 다시 한 걸음(retried)을 붙인다
 */
export function loadSequenceRuns(dirs) {
  const out = []
  for (const d of dirs) {
    const root = path.resolve(d)
    if (!fs.existsSync(root)) continue
    for (const s of fs.readdirSync(root, { withFileTypes: true })) {
      if (!s.isDirectory() || s.name === 'checkpoints') continue
      for (const r of fs.readdirSync(path.join(root, s.name), { withFileTypes: true })) {
        if (!r.isDirectory()) continue
        const dir = path.join(root, s.name, r.name)
        const run = readJson(path.join(dir, 'run.json'), null)
        if (!run?.sequence) continue
        out.push(withFlags({ ...run, dir }, countsOf(run.scenario)))
      }
    }
  }
  return out
}

const counts = new Map()
/** 시나리오의 Work 수와 봉인 과제 수 */
function countsOf(id) {
  if (!counts.has(id)) {
    const sc = loadScenario(id)
    counts.set(id, { works: workParts(sc).length, sealed: sealedTasks(sc.dir, sc).length })
  }
  return counts.get(id)
}

/** 줄에 쪽과 다 했는지를 붙인다. n은 시나리오의 Work 수와 봉인 과제 수다 */
export function withFlags(run, n = { works: 15, sealed: 3 }) {
  const { works: workCount, sealed: sealedCount } = n
  return {
    ...run,
    arm: run.kind,
    sealed: run.sealed ?? [],
    worksComplete: (run.works ?? []).length === workCount,
    sealedComplete: (run.sealed ?? []).length === sealedCount,
    retried: Object.entries(run.attempts ?? {})
      .filter(([, v]) => v > 1)
      .map(([k]) => k),
    // 다시 한 시도의 까닭: tool_error(도구 문제로 멈춤), restart(끊겨서 다시: kill, 컨테이너가 다시 뜸)
    retryCauses: Object.values(run.failures ?? {})
      .flat()
      .reduce((a, x) => ({ ...a, [x?.cause ?? '?']: (a[x?.cause ?? '?'] ?? 0) + 1 }), {}),
  }
}

/**
 * 두 쪽 값의 정확한 순열 p(양쪽): 두 쪽을 합친 값을 같은 크기로 나누는 모든 경우 가운데 평균 차이의 절댓값이 본 것 이상인
 * 비율. 합쳐 14개가 넘으면 null(이 평가는 3 대 3: 20가지, 가장 작은 p = 0.1)
 */
export function permutationP(a, b) {
  const all = [...a, ...b]
  const n = a.length
  if (!n || !b.length || all.length > 14) return null
  const avg = (xs) => xs.reduce((x, y) => x + y, 0) / xs.length
  const obs = Math.abs(avg(a) - avg(b))
  let hit = 0
  let total = 0
  const pick = []
  const walk = (from) => {
    if (pick.length === n) {
      const inA = new Set(pick)
      const A = pick.map((k) => all[k])
      const B = all.filter((_, k) => !inA.has(k))
      total++
      if (Math.abs(avg(A) - avg(B)) >= obs - 1e-12) hit++
      return
    }
    for (let k = from; k < all.length; k++) {
      pick.push(k)
      walk(k + 1)
      pick.pop()
    }
  }
  walk(0)
  return hit / total
}

/**
 * 한 지표의 읽기(방향을 붙인 것). 두 쪽의 모든 줄이 같은 값이면 '판정 없음'(천장·바닥이면 그 말을 붙인다: 차이를 볼 수 없는 것이지
 * 같다는 증거가 아니다). 아니면 equivalence의 같음/모름, '다름'과 δ 없는 지표의 0 밖은 좋은 방향에 따라 좋음/나쁨이다
 */
export function m3Verdict(c, metric, a, b) {
  if (!c) return null
  const all = [...a, ...b]
  if (all.length && all.every((v) => v === all[0])) {
    const [lo, hi] = metric.bounds ?? [null, null]
    const at = all[0] === lo ? '바닥' : all[0] === hi ? '천장' : null
    return at ? `판정 없음(${at})` : '판정 없음(모두 같은 값)'
  }
  const e = equivalence(c, metric.delta)
  const dir = (sign) => (sign * metric.better > 0 ? '좋음' : '나쁨')
  if (metric.delta === null || metric.delta === undefined)
    return c.lo > 0 ? dir(1) : c.hi < 0 ? dir(-1) : '모름'
  if (e === '다름') return dir(Math.sign(c.diff))
  return e
}

/** 두 쪽의 한 지표 차이(a − b): 줄을 단위로 한 bootstrap 95% 구간과 동등 판정 */
export function m3Compare(runs, a, b, metric) {
  const ids = [...new Set(runs.map((r) => r.scenario))].sort()
  const vals = (arm, id) =>
    runs
      .filter((r) => r.arm === arm && r.scenario === id)
      .map((r) => metric.of(r))
      .filter((v) => v !== null && v !== undefined)
  const groups = ids.map((id) => ({ id, a: vals(a, id), b: vals(b, id) }))
  const c = compare(groups)
  if (!c) return null
  const va = groups.flatMap((g) => g.a)
  const vb = groups.flatMap((g) => g.b)
  // 시나리오가 하나일 때만 순열 p를 낸다(층을 나눈 순열은 이 평가에 없다)
  const p =
    groups.filter((g) => g.a.length && g.b.length).length === 1 ? permutationP(va, vb) : null
  const verdict = m3Verdict(c, metric, va, vb)
  return {
    ...c,
    n: [va.length, vb.length],
    reading: equivalence(c, metric.delta),
    verdict,
    p,
    // 묶음의 판정 규칙에 드는 좋음·나쁨: 규칙에 드는 지표, 쪽마다 다 한 줄 둘 이상, 구간과 순열 p가 함께 맞음
    counts:
      !!metric.decides &&
      (verdict === '좋음' || verdict === '나쁨') &&
      va.length >= 2 &&
      vb.length >= 2 &&
      p !== null &&
      p <= PERM_ALPHA + 1e-9,
  }
}

const f = (x, d = 2) => (x === null || x === undefined ? '-' : Number(x).toFixed(d))
const table = (head, rows) =>
  [
    `| ${head.join(' | ')} |`,
    `|${head.map(() => '---').join('|')}|`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n')
const tally = (obj) =>
  Object.entries(obj ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k} ${v}`)
    .join(', ') || '-'
const add = (acc, k, n = 1) => {
  acc[k] = (acc[k] ?? 0) + n
  return acc
}

/**
 * Work 번호마다 쪽의 누적 시험 통과 비율 평균과 넣기(app, harness 등)의 수. 깨진 앞 Work 시험은 id만 센다
 */
export function perWorkRows(runs, arms) {
  const n = Math.max(0, ...runs.map((r) => (r.works ?? []).length))
  const rows = []
  for (let k = 1; k <= n; k++) {
    const cells = arms.map((arm) => {
      const ws = runs
        .filter((r) => r.arm === arm)
        .map((r) => r.works.find((w) => w.work === k))
        .filter(Boolean)
      if (!ws.length) return '-'
      // 누적 시험이 없는 Work는 비율에서 빠진다(cumRates와 같음)
      const rate = mean(
        ws
          .map((w) => (w.cumulative?.total ? w.cumulative.pass / w.cumulative.total : null))
          .filter(num),
      )
      const via = tally(ws.reduce((a, w) => add(a, w.landing?.via ?? '?'), {}))
      const broken = ws.reduce((a, w) => a + (w.cumulative?.broken?.length ?? 0), 0)
      const regressed = ws.reduce((a, w) => a + (w.cumulative?.regressed?.length ?? 0), 0)
      return `${f(rate)} (n ${ws.length}; ${via}${broken ? `; 실패한 앞 Work 시험 ${broken}, 이번에 깨짐 ${regressed}` : ''})`
    })
    rows.push([String(k), ...cells])
  }
  return rows
}

const ownPass = (w) =>
  !!w.cumulative?.own?.total && w.cumulative.own.pass === w.cumulative.own.total
const share = (k, n) => (n ? `${k}/${n} (${f(k / n)})` : `${k}/0`)

/**
 * 한 쪽 줄들의 장치 셈(규약 5.3·5.5). 다 한 줄(Work 모두)만 센다. 비율은 줄을 합쳐 세고 분모(실제로 센 것의 수)를 함께 낸다:
 * 장치만의 끄는 조건의 최소 n은 이 분모로 본다
 */
export function deviceCounts(lines) {
  const rs = lines.filter((r) => r.worksComplete)
  const pairs = rs.flatMap((r) =>
    r.works.flatMap((w) => (w.appWorks ?? []).map((aw) => ({ r, w, aw }))),
  )
  const app = pairs.map((x) => x.aw)
  const m3 = (aw) => aw.m3 ?? {}
  // V38 형식 확인: 어느 묶음에서든 형식 오류가 난 앱 Work와 그 가운데 마지막 묶음에도 형식 오류가 남은 채 머지된 것
  const formatWorks = app.filter((aw) => m3(aw).issuesAny?.format)
  const formatMerged = formatWorks.filter((aw) => aw.merged && (m3(aw).knowledge?.format ?? 0) > 0)
  // V41: 목록에 빚이 있던 Work(request.md '이 레포의 빚' 항목 1개 이상), 계약 tidy가 있는 Work
  const listWorks = app.filter((aw) => (m3(aw).request?.debt ?? 0) > 0)
  const listTaken = listWorks.filter((aw) => (m3(aw).tidy?.taken ?? 0) > 0)
  const tidyWorks = app.filter((aw) => (m3(aw).tidy?.taken ?? 0) > 0)
  const takenIds = tidyWorks.reduce((a, aw) => a + m3(aw).tidy.taken, 0)
  const paid = tidyWorks.reduce((a, aw) => a + (m3(aw).tidy.takenStatus?.paid ?? 0), 0)
  const overCap = tidyWorks.filter(
    (aw) => num(m3(aw).tidy.lines) && num(m3(aw).tidy.max) && m3(aw).tidy.lines > m3(aw).tidy.max,
  )
  const intact = pairs.filter((x) => (m3(x.aw).tidy?.intactDeleted ?? []).length > 0)
  const intactFailed = intact.filter(
    (x) => !ownPass(x.w) || (x.w.cumulative?.regressed ?? []).length > 0,
  )
  // V42: 마지막 레포의 규칙 항목과 승격된 항목(줄을 합침), 줄마다 한 번이라도 승격된 검사와 그 가운데 쓸모없음
  const finalRules = rs.map((r) => r.structure?.repo?.rules).filter(Boolean)
  const ruleItems = finalRules.reduce((a, x) => a + (x.items ?? 0), 0)
  const promotedItems = finalRules.reduce((a, x) => a + (x.promotedItems ?? 0), 0)
  let promotedEver = 0
  let useless = 0
  for (const r of rs) {
    const ever = new Set()
    for (const w of r.works) for (const c of w.rules?.promoted ?? []) ever.add(c)
    const last = new Set(r.structure?.repo?.rules?.promoted ?? [])
    for (const c of last) ever.add(c)
    // 허용 목록이 늚을 그대로 머지한 검사
    const allowMerged = new Set(
      r.works.flatMap((w) =>
        (w.appWorks ?? [])
          .filter((aw) => aw.merged)
          .flatMap((aw) => aw.m3?.knowledge?.allowChecks ?? []),
      ),
    )
    promotedEver += ever.size
    useless += [...ever].filter((c) => !last.has(c) || allowMerged.has(c)).length
  }
  const allowWorks = app.filter((aw) => m3(aw).issuesAny?.allow)
  const allowMerged = allowWorks.filter((aw) => aw.merged && (m3(aw).knowledge?.allow ?? 0) > 0)
  // 말로만 남은 규칙(마지막 묶음 spoken): Work 1~5, 6~10, 11~15의 앱 Work 평균
  const spoken = [
    [1, 5],
    [6, 10],
    [11, 15],
  ].map(([lo, hi]) =>
    mean(
      pairs
        .filter((x) => x.w.work >= lo && x.w.work <= hi)
        .map((x) => m3(x.aw).knowledge?.spoken)
        .filter(num),
    ),
  )
  return {
    lines: rs.length,
    appWorks: app.length,
    debtRecorded: app.reduce((a, aw) => a + (m3(aw).debt?.recorded ?? 0), 0),
    format: { works: formatWorks.length, merged: formatMerged.length },
    tidy: {
      listWorks: listWorks.length,
      listTaken: listTaken.length,
      tidyWorks: tidyWorks.length,
      takenIds,
      paid,
      overCap: overCap.length,
      intact: intact.reduce((a, x) => a + m3(x.aw).tidy.intactDeleted.length, 0),
      intactFailed: intactFailed.length,
    },
    promote: {
      ruleItems,
      promotedItems,
      promotedEver,
      useless,
      allowWorks: allowWorks.length,
      allowMerged: allowMerged.length,
      spoken,
    },
  }
}

/** 앱 Work들(relay-v3 쪽)의 M3 장치 지표와 끝의 까닭. [이름, 쪽마다 값] 줄 */
export function deviceRows(runs, arms) {
  const appWorks = (arm) =>
    runs.filter((r) => r.arm === arm).flatMap((r) => r.works.flatMap((w) => w.appWorks ?? []))
  // 앱 Work가 없는 쪽(cli)은 '-'다. all이면 줄(마지막 레포, 장부)로 세어 cli도 보인다
  const perArm = (fn, all = false) =>
    arms.map((arm) => {
      const ws = appWorks(arm)
      const rs = runs.filter((r) => r.arm === arm)
      return ws.length || (all && rs.length) ? fn(ws, rs) : '-'
    })
  const sum = (ws, fn) => ws.reduce((a, w) => a + (Number(fn(w)) || 0), 0)
  return [
    ['앱 Work 수', ...perArm((ws) => String(ws.length))],
    [
      '끝(ended.how)',
      ...perArm((ws) =>
        tally(ws.reduce((a, w) => add(a, w.devices?.endReasons?.how ?? w.end ?? '?'), {})),
      ),
    ],
    [
      '넘긴 끝(end_handed) / 넘긴 끝으로 끝남',
      ...perArm(
        (ws) =>
          `${sum(ws, (w) => w.devices?.endReasons?.handed)} / ${ws.filter((w) => w.devices?.endReasons?.endedHanded).length}`,
      ),
    ],
    [
      '푼 끝의 까닭(end_cancelled)',
      ...perArm((ws) =>
        tally(
          ws.reduce((a, w) => {
            for (const [k, v] of Object.entries(w.devices?.endReasons?.cancelled ?? {}))
              add(a, k, v)
            return a
          }, {}),
        ),
      ),
    ],
    [
      '끝낼 때 메모(ended.memos 합)',
      ...perArm((ws) => String(sum(ws, (w) => w.devices?.endReasons?.memos))),
    ],
    [
      'M3 스위치(knowledge·debt·tidy·promote 켠 Work)',
      ...perArm((ws) =>
        ['knowledge', 'debt', 'tidy', 'promote']
          .map((d) => `${d} ${ws.filter((w) => w.m3?.switches?.[d] === true).length}`)
          .join(', '),
      ),
    ],
    [
      'request.md 관련 지식 항목(Work 평균)',
      ...perArm((ws) => f(mean(ws.map((w) => w.m3?.request?.knowledge).filter(num)))),
    ],
    [
      '지식 파일을 바꾼 Work / 형식 오류',
      ...perArm(
        (ws) =>
          `${ws.filter((w) => (w.m3?.knowledge?.changed ?? 0) > 0).length} / ${sum(ws, (w) => w.m3?.knowledge?.format)}`,
      ),
    ],
    [
      '근거 knowledge 찾음/모두',
      ...perArm(
        (ws) =>
          `${sum(ws, (w) => w.m3?.groundings?.found)}/${sum(ws, (w) => w.m3?.groundings?.total)}`,
      ),
    ],
    [
      '빚 기록(debt_recorded) / 항목',
      ...perArm(
        (ws) => `${sum(ws, (w) => w.m3?.debt?.recorded)} / ${sum(ws, (w) => w.m3?.debt?.items)}`,
      ),
    ],
    [
      '나빠진 래칫이 마지막 묶음에 있던 Work',
      ...perArm((ws) => String(ws.filter((w) => (w.m3?.debt?.finalWorse ?? []).length > 0).length)),
    ],
    [
      '기록 안 된 나빠짐(새 Work가 찾은 항목 합)',
      ...perArm((ws) => String(sum(ws, (w) => w.m3?.unrecorded))),
    ],
    [
      '장부: 받아들인 나빠짐 / 기록함 / 기록 안 함(줄 평균)',
      ...perArm((ws, rs) => {
        const led = rs.map((r) => r.structure?.ledger).filter(Boolean)
        return led.length
          ? `${f(mean(led.map((l) => l.accepted)))} / ${f(mean(led.map((l) => l.recorded)))} / ${f(mean(led.map((l) => l.unrecorded)))}`
          : '-'
      }),
    ],
    [
      '마지막 레포의 .relay/debt 항목(줄 평균)',
      ...perArm(
        (ws, rs) => f(mean(rs.map((r) => r.structure?.repo?.debt?.items).filter(num))),
        true,
      ),
    ],
    [
      '마지막 레포의 docs/knowledge 파일(줄 평균)',
      ...perArm((ws, rs) => f(mean(rs.map((r) => r.structure?.repo?.knowledge).filter(num))), true),
    ],
    [
      'V38 형식: 어느 묶음에서든 형식 오류가 난 앱 Work / 그 가운데 형식 오류가 남은 채 머지',
      ...perArm((ws, rs) => {
        const d = deviceCounts(rs).format
        return share(d.merged, d.works)
      }),
    ],
    [
      'V41 수용: 목록에 빚이 있던 앱 Work / 그 가운데 계약 tidy를 둔 것',
      ...perArm((ws, rs) => {
        const d = deviceCounts(rs).tidy
        return share(d.listTaken, d.listWorks)
      }),
    ],
    [
      'V41 해결: 계약 tidy id / 그 가운데 마지막 묶음에서 paid',
      ...perArm((ws, rs) => {
        const d = deviceCounts(rs).tidy
        return share(d.paid, d.takenIds)
      }),
    ],
    [
      'V41 상한 넘음: 계약 tidy가 있는 앱 Work / 정리 몫이 상한을 넘은 것',
      ...perArm((ws, rs) => {
        const d = deviceCounts(rs).tidy
        return share(d.overCap, d.tidyWorks)
      }),
    ],
    [
      'V41 멀쩡한 항목(계약 tidy가 아닌데 open이고 항목 파일을 지움) / 그 Work의 숨긴 시험 실패와 겹친 Work',
      ...perArm((ws, rs) => {
        const d = deviceCounts(rs).tidy
        return `${d.intact} / ${d.intactFailed}`
      }),
    ],
    [
      'V42 승격률: 마지막 레포의 규칙 항목 / 그 가운데 승격된 것(줄을 합침)',
      ...perArm((ws, rs) => {
        const d = deviceCounts(rs).promote
        return share(d.promotedItems, d.ruleItems)
      }, true),
    ],
    [
      "V42 '쓸모없음': 한 번이라도 승격된 검사 / 그 가운데 뒤에 빠졌거나 허용 목록이 늚을 그대로 머지한 것",
      ...perArm((ws, rs) => {
        const d = deviceCounts(rs).promote
        return share(d.useless, d.promotedEver)
      }, true),
    ],
    [
      'V42 허용 목록이 늚: 그 사실이 난 앱 Work / 그 가운데 남은 채 머지',
      ...perArm((ws, rs) => {
        const d = deviceCounts(rs).promote
        return share(d.allowMerged, d.allowWorks)
      }),
    ],
    [
      'V42 말로만 남은 규칙(마지막 묶음 spoken, 앱 Work 평균: Work 1~5, 6~10, 11~15)',
      ...perArm((ws, rs) =>
        deviceCounts(rs)
          .promote.spoken.map((x) => f(x))
          .join(', '),
      ),
    ],
    [
      '에이전트 프로젝트 메모리: 프로젝트 키 / 메모리가 있는 키 / 파일(줄 평균)',
      ...perArm((ws, rs) => {
        const m = rs.map((r) => r.structure?.agentMemory).filter(Boolean)
        return m.length
          ? `${f(mean(m.map((x) => x.projects)))} / ${f(mean(m.map((x) => x.withMemory)))} / ${f(mean(m.map((x) => x.files)))}`
          : '-'
      }, true),
    ],
  ]
}

/**
 * V35(규약 5.4): 앱 Work의 끝 방식(마지막 ended.how)마다 앱 Work 수와 그 앱 Work가 든 평가 Work의 자기 시험이 모두 통과한 수.
 * relay3과 relay3-m2를 합친 칸(V35는 두 쪽에 같다)을 끝에 둔다. how가 없으면(머리줄 [끝내기]를 거치지 않음, 대개 [머지]) '-'
 */
export function v35Rows(runs, arms) {
  const relayArms = arms.filter((a) => a !== CLI)
  const pairsOf = (arm) =>
    runs
      .filter((r) => r.arm === arm && r.worksComplete)
      .flatMap((r) => r.works.flatMap((w) => (w.appWorks ?? []).map((aw) => ({ w, aw }))))
  const how = (x) => x.aw.devices?.endReasons?.how ?? '-'
  const all = relayArms.flatMap(pairsOf)
  const kinds = [...new Set(all.map(how))].sort()
  const cell = (xs) => `${xs.length} (자기 시험 통과 ${xs.filter((x) => ownPass(x.w)).length})`
  return kinds.map((k) => [
    k,
    ...relayArms.map((arm) => cell(pairsOf(arm).filter((x) => how(x) === k))),
    cell(all.filter((x) => how(x) === k)),
  ])
}

/** 보고서. runs는 loadSequenceRuns */
export function m3Report(runs, o = {}) {
  const arms = [
    ...ARMS.filter((a) => runs.some((r) => r.arm === a)),
    ...[...new Set(runs.map((r) => r.arm))].filter((a) => !ARMS.includes(a)).sort(),
  ]
  const lines = [
    '# M3 장기 평가 주지표 (relay-v3 docs/m3-design.md 6절)',
    '',
    ...(o.dirs?.length ? [`- 결과 폴더: ${o.dirs.map((d) => `\`${d}\``).join(', ')}`] : []),
    `- 줄(쪽 × 회차) ${runs.length}개: ${arms.map((a) => `${a} ${runs.filter((r) => r.arm === a).length}`).join(', ')}`,
    `- 다 한 줄(Work 모두, 봉인 과제 모두): ${runs.filter((r) => r.worksComplete && r.sealedComplete).length}개. 덜 한 줄은 그 지표에서 빠진다`,
    `- 도구 문제로 체크포인트에서 다시 한 걸음이 있는 줄: ${
      runs
        .filter((r) => r.retried.length)
        .map((r) => `${r.arm}#${r.index}(${r.retried.join(',')})`)
        .join(', ') || '없음'
    }`,
    `- 다시 한 시도(쪽마다, 까닭): ${arms
      .map(
        (a) =>
          `${a} ${tally(
            runs
              .filter((r) => r.arm === a)
              .reduce((acc, r) => {
                for (const [k, v] of Object.entries(r.retryCauses ?? {})) add(acc, k, v)
                return acc
              }, {}),
          )}`,
      )
      .join('; ')}`,
    '- 구간: 줄을 단위로 한 bootstrap 95%(시나리오마다 층, 10,000번, 씨앗 고정, primary.mjs compare). 동등 판정: ±δ 안 같음, δ 밖 다름, 걸침 모름(δ 없는 지표는 0을 넘는지). δ는 제안(S1·C1·C2 10%포인트, PM1 1회)이고 규약에서 고정한다',
    '',
    '## 줄마다',
    '',
    table(
      [
        '줄',
        'Work',
        '봉인 과제 통과',
        '누적 시험(마지막)',
        '다시 말함 / 기회',
        '다시 한 걸음(까닭)',
        '평가 자리에 닿은 과제',
        'Work 에이전트: 평가 자리 가리킴 / 보임 / github',
      ],
      runs
        .slice()
        .sort((a, b) => a.arm.localeCompare(b.arm) || a.index - b.index)
        .map((r) => {
          const last = r.works.at(-1)?.cumulative
          return [
            `${r.arm}#${r.index}`,
            `${r.works.length}`,
            r.sealed.length
              ? `${r.sealed.filter((s) => s.pass).length}/${r.sealed.length} (${r.sealed.map((s) => `${s.id} ${s.pass ? 'O' : 'X'}`).join(', ')})`
              : '-',
            last ? `${last.pass}/${last.total}` : '-',
            // 다시 말할 기회(carriedTotal): 앞서 실제로 말한 규칙이 다시 든 수. 쪽 사이에서 다르면 PM1을 그대로 견주지 못한다
            `${r.works.reduce((a, w) => a + retellsOf(w), 0)} / ${r.works.reduce((a, w) => a + (w.human?.carriedTotal ?? 0), 0)}`,
            r.retried.length
              ? `${r.retried.join(', ')} (${tally(r.retryCauses) === '-' ? '?' : tally(r.retryCauses)})`
              : '-',
            // 기준 에이전트가 평가의 자리(시나리오 폴더, 판정 임시 폴더 등)를 가리킨 과제(lib/sealed-run.mjs outsideReach)
            r.sealed.some((s) => s.outside?.reach)
              ? r.sealed
                  .filter((s) => s.outside?.reach)
                  .map((s) => s.id)
                  .join(', ')
              : '-',
            // Work 에이전트의 격리 감사(lib/sequence-run.mjs workAudit): 가리킨 도구 호출, 결과에 평가 자리가 보인 수, github
            ['reach', 'seen', 'github']
              .map((k) => String(r.works.reduce((a, w) => a + (w.outside?.[k] ?? 0), 0)))
              .join(' / '),
          ]
        }),
    ),
    '',
    '## 쪽마다 평균 (n)',
    '',
    table(
      ['지표', ...arms],
      M3_METRICS.map((m) => [
        `${m.primary ? '**' : ''}${m.key}${m.primary ? '**' : ''} ${m.name}`,
        ...arms.map((arm) => {
          const v = runs
            .filter((r) => r.arm === arm)
            .map((r) => m.of(r))
            .filter(num)
          return v.length ? `${f(mean(v))} (${v.length})` : '-'
        }),
      ]),
    ),
    '',
    '## 차이 (a − b)',
    '',
  ]
  const results = {}
  const rows = []
  for (const [a, b] of M3_PAIRS) {
    if (!arms.includes(a) || !arms.includes(b)) continue
    for (const m of M3_METRICS) {
      const c = m3Compare(runs, a, b, m)
      results[`${a}:${b}:${m.key}`] = c
      rows.push([
        `${a} − ${b}`,
        `${m.primary ? '**' : ''}${m.key}${m.primary ? '**' : ''}`,
        c ? `${c.n[0]}, ${c.n[1]}` : '-',
        c ? f(c.diff) : '-',
        c ? `[${f(c.lo)}, ${f(c.hi)}]` : '-',
        m.delta === null ? '-' : String(m.delta),
        c?.verdict ?? '자료 없음',
        c?.p === null || c?.p === undefined ? '-' : f(c.p),
        !m.decides ? '보고만' : c?.counts ? '듦' : '-',
      ])
    }
  }
  lines.push(
    rows.length
      ? table(['짝', '지표', 'n', '차이', '95% 구간', 'δ', '읽기', '순열 p', '규칙에'], rows)
      : '(견줄 짝 없음)',
    '',
    `'규칙에 듦'은 묶음의 판정 규칙에 드는 지표(S1, C1, C2, PM1)의 좋음·나쁨 가운데 구간과 순열 p(≤ ${PERM_ALPHA})가 함께 맞고 쪽마다 다 한 줄이 둘 이상인 것이다. '판정 없음'은 두 쪽의 모든 줄이 같은 값이라 차이를 볼 수 없는 것이다(같다는 증거가 아니다). S2·S3·C3·T·W는 보고만이다(T의 같음은 V40·V41의 끄는 조건에만 쓴다).`,
    '',
    `M3 장치를 켤지(m3-design 1절 '같으면(δ 안) 기본에서 뺀다')는 ${RELAY3} − ${RELAY3_M2}의 주지표로 규약이 정한다. 이 표는 읽기만 보인다.`,
    '',
    '## Work마다 누적 숨긴 시험 통과 (쪽 평균; 넣기 방식; 실패한 앞 Work 시험 수와 그 가운데 그 Work가 깨뜨린 수)',
    '',
    table(['Work', ...arms], perWorkRows(runs, arms)),
    '',
    '## M3 장치와 끝 (relay-v3 쪽, 앱 Work 기준)',
    '',
    table(['지표', ...arms], deviceRows(runs, arms)),
    '',
    'V38·V41·V42 줄은 Work를 모두 한 줄만 센다. 비율의 분모(앞 수)가 장치만의 끄는 조건의 최소 n에 대는 수다.',
    '',
    '## 넘긴 끝 (V35: 앱 Work의 마지막 ended.how마다 앱 Work 수와 자기 시험 통과)',
    '',
    table(['ended.how', ...arms.filter((a) => a !== CLI), '합(relay-v3 쪽)'], v35Rows(runs, arms)),
    '',
  )
  return { text: lines.join('\n'), comparisons: results }
}

if (isMain(import.meta.url)) {
  const { values: v, positionals } = parseArgs({
    allowPositionals: true,
    options: { out: { type: 'string' } },
  })
  if (!positionals.length) {
    console.error('쓰는 법: node eval/m3-primary.mjs <결과 폴더>... [--out 파일.md]')
    process.exit(2)
  }
  const { text } = m3Report(loadSequenceRuns(positionals), { dirs: positionals })
  if (v.out) fs.writeFileSync(v.out, text)
  console.log(text)
}
