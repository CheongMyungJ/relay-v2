#!/usr/bin/env node
// relay-v3 M3 장기 평가(docs/m3-design.md 6절 '주지표: 봉인 과제 통과율, 뒤 Work 비용, 누적 숨긴 시험 통과, 다시 말하기. 구조
// 지표는 보조')의 집계. run-sequence.mjs의 결과 폴더(여럿)에서 줄(쪽 × 회차)마다 run.json(lib/sequence-run.mjs composeRun)을
// 읽는다. 분석 단위는 줄 하나다(Work 15개와 봉인 과제 셋이 한 줄의 값 하나가 된다). 쪽마다 평균을 내고, 두 쪽의 차이는
// m2-primary·m21-primary와 같은 구간(primary.mjs compare: 시나리오마다 층을 나눈 bootstrap 95%, 10,000번, 씨앗 고정)과 같은
// 동등 판정(m2-primary equivalence: ±δ 안이면 같음, 구간이 δ 밖이면 다름, 걸치면 모름. δ가 없는 지표는 0을 넘는지)으로 읽는다.
// 시나리오가 하나(48)라 층은 하나이고 쪽마다 n=3이면 작은 차이는 '모름'으로 나오기 쉽다(m3-design 머리의 사용자 결정).
// δ는 규약에서 결과 전에 고정한다. 여기 값(M3_METRICS)은 제안이다.
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

/**
 * 지표. primary는 주지표(6절), better는 좋은 방향, delta는 동등 한계 δ(제안, 규약에서 고정). of(줄)이 null이면 그 줄은 빠진다
 */
export const M3_METRICS = [
  {
    key: 'S1',
    name: '봉인 과제 통과율',
    primary: true,
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
    better: 1,
    delta: 0.1,
    of: (r) => (r.worksComplete ? mean(cumRates(r)) : null),
  },
  {
    key: 'C2',
    name: '마지막 Work 뒤 누적 숨긴 시험 통과 비율',
    primary: true,
    better: 1,
    delta: 0.1,
    of: (r) => (r.worksComplete ? (cumRates(r).at(-1) ?? null) : null),
  },
  {
    key: 'PM1',
    name: '다시 말하기(열 전체에서 이미 말한 규칙을 다시 말한 수)',
    primary: true,
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
    delta: null,
    of: (r) => r.structure?.final?.longest?.lines ?? null,
  },
  {
    key: 'T2',
    name: '상한(600줄)을 넘는 파일 수',
    better: -1,
    delta: null,
    of: (r) => r.structure?.final?.over?.count ?? null,
  },
  {
    key: 'T3',
    name: '중복 줄 비율(6줄 창, src)',
    better: -1,
    delta: null,
    of: (r) => r.structure?.final?.duplication?.ratio ?? null,
  },
  {
    key: 'T4',
    name: '두 파일 이상에 정의된 같은 이름의 함수 수(src)',
    better: -1,
    delta: null,
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
  }
}

/** 두 쪽의 한 지표 차이(a − b): 줄을 단위로 한 bootstrap 95% 구간과 동등 판정 */
export function m3Compare(runs, a, b, metric) {
  const ids = [...new Set(runs.map((r) => r.scenario))].sort()
  const vals = (arm, id) =>
    runs
      .filter((r) => r.arm === arm && r.scenario === id)
      .map((r) => metric.of(r))
      .filter((v) => v !== null && v !== undefined)
  const c = compare(ids.map((id) => ({ id, a: vals(a, id), b: vals(b, id) })))
  return c ? { ...c, reading: equivalence(c, metric.delta) } : null
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
      const rate = mean(
        ws.map((w) => (w.cumulative?.total ? w.cumulative.pass / w.cumulative.total : 0)),
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
      'M3 스위치(knowledge·debt·tidy 켠 Work)',
      ...perArm((ws) =>
        ['knowledge', 'debt', 'tidy']
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
  ]
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
    '- 구간: 줄을 단위로 한 bootstrap 95%(시나리오마다 층, 10,000번, 씨앗 고정, primary.mjs compare). 동등 판정: ±δ 안 같음, δ 밖 다름, 걸침 모름(δ 없는 지표는 0을 넘는지). δ는 제안(S1·C1·C2 10%포인트, PM1 1회)이고 규약에서 고정한다',
    '',
    '## 줄마다',
    '',
    table(
      ['줄', 'Work', '봉인 과제 통과', '누적 시험(마지막)', '다시 말함', '다시 한 걸음'],
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
            String(r.works.reduce((a, w) => a + retellsOf(w), 0)),
            r.retried.join(', ') || '-',
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
        c ? f(c.diff) : '-',
        c ? `[${f(c.lo)}, ${f(c.hi)}]` : '-',
        m.delta === null ? '-' : String(m.delta),
        c?.reading ?? '자료 없음',
      ])
    }
  }
  lines.push(
    rows.length ? table(['짝', '지표', '차이', '95% 구간', 'δ', '읽기'], rows) : '(견줄 짝 없음)',
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
