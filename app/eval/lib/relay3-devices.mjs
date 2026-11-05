// relay-v3 M2.1 장치의 지표(relay-v3 docs/m2.1-design.md 14절 '장치마다 쓰는 지표는 events.jsonl에서 센다'). Work 하나의
// events.jsonl과 work.json, 증거 묶음에서 센다. 앱을 부르지 않는다. 옛 기록(M2, relay3-m2p)에는 이 기록들이
// 없어 0이거나 null이다. 기록의 이름과 칸은 relay-v3 main(works-end.ts, works-feedback.ts, works-probe.ts, works-review.ts,
// works-evidence.ts)이 남기는 그대로다:
//   ended {how: once | armed | box, head}, end_armed {head}, end_box {head, open}, end_cancelled {head, armed, reason},
//   end_moved {from, to, armed}, end_failed {head}, feedback {n, head, by: relay | human, facts, findings, keys},
//   feedback_held {head, reason: cap | human_findings | draft | human_input, facts, findings},
//   probe {tool, ran, problems, ms, note?}, export_missing {unit, branch}, review {trigger, reused?, aborted?, status, findings}
// savedDevices만 결과 폴더의 파일을 읽는다(예전 결과를 다시 모을 때).
import fs from 'node:fs'
import path from 'node:path'

/**
 * 올림인가(relay-v3 core/review.ts raises, V26): 관문에 사실로 들어가는 지적. 구조/low와 갈래(raise)가 없는 지적은 메모다.
 * 모르는 갈래와 심각도는 올림이다(엄격한 쪽)
 */
export function raises(f) {
  if (f?.raise === undefined || f?.raise === null) return false
  return f.raise !== 'structure' || f.severity !== 'low'
}

const count = (xs, pred) => xs.filter(pred).length
const sum = (xs, fn) => xs.reduce((a, x) => a + (Number(fn(x)) || 0), 0)
const ofType = (events, type) => events.filter((e) => e?.type === type)

/**
 * [끝내기](V25). how는 마지막 ended 기록의 끝낸 방식(once: 한 번에, armed: 걸렸다가, box: 상자에서 [그래도 끝내기]. M2의
 * [끝 확정]은 칸이 없어 null). presses는 [끝내기]를 누른 수로, 누름마다 남는 기록 하나(바로 끝남 ended once, 걸림
 * end_armed, 바로 뜬 상자 end_box)로 센다. 걸린 끝이 풀리며(리뷰 뒤) 뜬 상자는 누름이 아니다. ready는 그 가운데 누를 때
 * 내보내기 증거와 리뷰가 이미 끝나 있던 수(걸리지 않음)다. boxes는 상자가 뜬 수, forced는 [그래도 끝내기], cancelled는
 * [취소]·[더 고치기](reason human)와 계약이 바뀌어 지운 것(contract), moved는 세션의 새 커밋으로 지운 수, failed는 걸린
 * 동안 재기가 실패해 푼 수다
 */
export function endMetrics(events) {
  const out = {
    how: null,
    presses: 0,
    ready: 0,
    armed: 0,
    boxes: 0,
    forced: 0,
    cancelled: 0,
    cancelledByContract: 0,
    moved: 0,
    failed: 0,
  }
  let armed = false
  for (const e of events) {
    switch (e?.type) {
      case 'end_armed':
        out.presses++
        out.armed++
        armed = true
        break
      case 'end_box':
        out.boxes++
        if (armed) armed = false
        else {
          out.presses++
          out.ready++
        }
        break
      case 'ended':
        out.how = e.how ?? null
        if (e.how === 'once') {
          out.presses++
          out.ready++
        }
        if (e.how === 'box') out.forced++
        armed = false
        break
      case 'end_cancelled':
        if (e.reason === 'contract') out.cancelledByContract++
        else out.cancelled++
        if (e.armed) armed = false
        break
      case 'end_moved':
        out.moved++
        if (e.armed) armed = false
        break
      case 'end_failed':
        out.failed++
        armed = false
        break
    }
  }
  return out
}

/**
 * 되먹임(V24). rounds는 relay가 저절로 보낸 라운드(by relay), 그 가운데 결정론 사실이 든 것(factRounds)과 리뷰 지적이 든 것
 * (findingRounds), 보낸 사실과 지적의 수. passed는 사람이 [세션에 넘기기]로 보낸 수와 그 지적 수(passedFindings). held는
 * 보내지 않은 까닭마다 기록 수다(앱은 head와 까닭마다 한 번 남긴다)
 */
export function feedbackMetrics(events) {
  const sent = ofType(events, 'feedback')
  const relay = sent.filter((e) => e.by !== 'human')
  const human = sent.filter((e) => e.by === 'human')
  const held = {}
  for (const e of ofType(events, 'feedback_held')) {
    const k = typeof e.reason === 'string' ? e.reason : '?'
    held[k] = (held[k] ?? 0) + 1
  }
  return {
    rounds: relay.length,
    factRounds: count(relay, (e) => (e.facts ?? 0) > 0),
    findingRounds: count(relay, (e) => (e.findings ?? 0) > 0),
    facts: sum(relay, (e) => e.facts),
    findings: sum(relay, (e) => e.findings),
    passed: human.length,
    passedFindings: sum(human, (e) => e.findings),
    held,
  }
}

/**
 * 되먹임으로 보내는 결정론 사실의 이름(relay-v3 core/review.ts feedbackFacts의 key와 같은 규칙): 못 미침·증거 없음 줄, 실패하거나
 * 돌지 못한 명령, 나빠진 래칫, 승인본과 같지 않은 예시 자료. 품질 기준이 없으면 없다. 수용 시험 명령이 없으면 줄 사실은 없다
 */
export function factKeys(b) {
  if (!b || b.quality?.from === 'none') return []
  const id = b.contract?.id
  const lines = id === undefined || (b.missing ?? []).includes('acceptance') ? [] : (b.lines ?? [])
  const f = b.examples_file
  return [
    ...lines
      .filter((v) => v.status === 'not_met' || v.status === 'missing_evidence')
      .map((v) => `line:${v.line}:${v.status}`),
    ...(b.commands ?? [])
      .filter((c) => c.outcome === 'fail' || c.outcome === 'not_run')
      .map((c) => `command:${c.id}:${c.outcome}`),
    ...(b.ratchets ?? []).filter((r) => r.status === 'worse').map((r) => `ratchet:${r.id}:worse`),
    ...(f && f.status !== 'same' ? [`examples:${f.status}`] : []),
  ]
}

/** 리뷰 지적의 이름(relay-v3 core/review.ts findingKey와 같다): 갈래, 심각도, 파일, 줄, 글 */
export const findingKey = (f) =>
  `review:${JSON.stringify([f.raise ?? null, f.severity, f.file ?? null, f.line ?? null, f.text])}`

/**
 * 보낸 되먹임이 어떻게 됐나(V24 지표 '보낸 사실이 어떻게 됐는가', 14절 도구: feedback 기록의 keys와 다음 head의 묶음으로 센다).
 * 보낸 사실은 그 뒤 처음 잰 다른 head의 묶음에 같은 이름의 사실이 없으면 고쳐짐(fixed), 있으면 남음(kept)이다. 보낸 지적은
 * 그 뒤 처음 리뷰가 끝난 다른 head의 묶음이 같은 지적(findingKey)을 다시 올리지 않으면 고쳐짐이다. 다음 묶음이 없으면(끝남,
 * 단위 브랜치의 되먹임처럼 head마다의 묶음이 남지 않음) unknown이다. harmful은 다음 묶음에서 그 head에 충족이던 줄이 못
 * 미침이 되었거나, 새 계약 밖 변경 올림이나 시험 약화 신호가 생긴 라운드의 수다. relay가 저절로 보낸 것(relay)과 사람이
 * [세션에 넘기기]로 보낸 것(human)을 따로 센다. 지적의 '고쳐짐'은 다음 리뷰가 같은 글로 다시 올리지 않은 것이라 후하다
 * @param {object[]} events
 * @param {Record<string, object>} byHead Work 브랜치 내보내기의 head마다 묶음(relay3-arm.mjs workBundles)
 */
export function feedbackOutcomes(events, byHead = {}) {
  const blank = () => ({
    facts: { fixed: 0, kept: 0, unknown: 0 },
    findings: { fixed: 0, kept: 0, unknown: 0 },
    harmful: 0,
  })
  const out = { relay: blank(), human: blank() }
  const later = (i, head, pred) =>
    events
      .slice(i + 1)
      .filter(
        (e) =>
          e?.type === 'evidence' &&
          e.integration !== true &&
          (e.unit ?? null) === null &&
          e.head !== head,
      )
      .map((e) => byHead[e.head])
      .find((b) => b && pred(b))
  events.forEach((e, i) => {
    if (e?.type !== 'feedback') return
    const o = e.by === 'human' ? out.human : out.relay
    const keys = Array.isArray(e.keys) ? e.keys : []
    const facts = keys.filter((k) => !String(k).startsWith('review:'))
    const findings = keys.filter((k) => String(k).startsWith('review:'))
    const own = e.unit === undefined || e.unit === null
    const next = own ? later(i, e.head, () => true) : undefined
    const nextReviewed = own ? later(i, e.head, (b) => b.review?.status === 'done') : undefined
    if (next) {
      const now = new Set(factKeys(next))
      for (const k of facts) o.facts[now.has(k) ? 'kept' : 'fixed']++
    } else o.facts.unknown += facts.length
    if (nextReviewed) {
      const now = new Set(doneFindings(nextReviewed).filter(raises).map(findingKey))
      for (const k of findings) o.findings[now.has(k) ? 'kept' : 'fixed']++
    } else o.findings.unknown += findings.length
    const before = own ? byHead[e.head] : undefined
    if (before && next) {
      const met = new Set((before.lines ?? []).filter((v) => v.status === 'met').map((v) => v.line))
      const worse = (next.lines ?? []).some((v) => met.has(v.line) && v.status === 'not_met')
      const had = new Set(doneFindings(before).map(findingKey))
      const outside = doneFindings(next).some(
        (f) => f.raise === 'out_of_contract' && !had.has(findingKey(f)),
      )
      const weak = (s) => (s?.signals ?? []).filter((x) => x?.kind === 'test_weakening').length
      if (worse || outside || weak(next) > weak(before)) o.harmful++
    }
  })
  return out
}

/**
 * 제출 때 기준 확인(V28). calls는 확인을 부른 제출 수(submit_contract와 계약을 담은 request_contract_change), ran은 실제로
 * 돈 수, rejected는 돌려보낸 제출(problems > 0), problems는 돌려보낸 줄의 합, ms는 돈 확인마다 걸린 시간이다
 */
export function probeMetrics(events) {
  const all = ofType(events, 'probe')
  const ran = all.filter((e) => e.ran === true)
  return {
    calls: all.length,
    ran: ran.length,
    rejected: count(ran, (e) => (e.problems ?? 0) > 0),
    problems: sum(ran, (e) => e.problems),
    ms: ran.map((e) => e.ms).filter((x) => typeof x === 'number' && Number.isFinite(x)),
  }
}

/**
 * 예시 자료(V27): 이 Work에서 잰 묶음(head마다)의 examples_file 상태를 센다. facts는 사람 머지 사실이 된 묶음(absent: 커밋되지
 * 않음, differs: 승인본과 다름, unreadable: 읽지 못함)의 수, final은 내보내기마다 마지막 묶음의 상태다. V27 앞의 묶음과 예시가
 * 없는 계약은 칸이 없거나 null이라 세지 않는다
 */
export function examplesMetrics(all, finals) {
  const statuses = all.map((b) => b?.examples_file?.status).filter((s) => typeof s === 'string')
  const by = (s) => count(statuses, (x) => x === s)
  return {
    bundles: statuses.length,
    absent: by('absent'),
    differs: by('differs'),
    unreadable: by('unreadable'),
    facts: by('absent') + by('differs') + by('unreadable'),
    final: finals.map((f) => f.bundle?.examples_file?.status ?? null),
  }
}

/** 묶음의 끝난 리뷰 지적. 끝나지 않은 리뷰(실패, 건너뜀)와 리뷰가 없는 묶음은 빈 것이다 */
const doneFindings = (b) =>
  b?.review?.status === 'done' && Array.isArray(b.review.findings) ? b.review.findings : []

/**
 * 리뷰 올림(V26, V30): 내보내기마다 마지막 묶음의 끝난 리뷰에서 올림과 메모(raises), 갈래별·심각도별 올림, request_gap 올림을
 * 센다. requestGapBundles는 이 Work에서 잰 묶음 가운데 리뷰가 request_gap을 올린 묶음의 수다(마지막이 아니어도)
 */
export function raiseMetrics(all, finals) {
  const exports = finals.map(({ unit, bundle }) => {
    const reviewed = bundle?.review?.status === 'done'
    const found = doneFindings(bundle)
    const raised = found.filter(raises)
    const byKind = {}
    const bySeverity = {}
    for (const f of raised) {
      byKind[f.raise] = (byKind[f.raise] ?? 0) + 1
      bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1
    }
    return {
      unit,
      reviewed,
      raised: raised.length,
      notes: found.length - raised.length,
      requestGap: count(raised, (f) => f.raise === 'request_gap'),
      byKind,
      bySeverity,
    }
  })
  return {
    exports,
    requestGapBundles: count(all, (b) => doneFindings(b).some((f) => f.raise === 'request_gap')),
  }
}

/** 계약의 단위(V21) 수. 줄에 unit이 없으면 0 */
function unitsOf(contract) {
  const lines = Array.isArray(contract?.lines) ? contract.lines : []
  return new Set(lines.map((l) => l?.unit).filter((u) => typeof u === 'string')).size
}

/**
 * Work 하나의 장치 지표. modern은 M2.1 기록(work.json에 내보내기 exports[]가 있음)인가다: 옛 기록(M2, relay3-m2p)에는 한 번
 * 끝·걸린 끝·상자, 되먹임, 제출 때 기준 확인, 예시 자료 견줌이 없어 그 지표는 0이 아니라 '없음'으로 읽는다(올림과 메모는
 * 옛 묶음에도 있다)
 * @param {object} o
 * @param {object[]} o.events events.jsonl의 기록
 * @param {object} o.rec work.json
 * @param {object | null} [o.contract] 승인된 계약(contract.json)
 * @param {{ unit: string | null, bundle: object | null }[]} [o.finals] 내보내기마다 마지막 묶음
 * @param {object[]} [o.all] 이 Work에서 잰 묶음 모두(relay3-arm.mjs workBundles)
 * @param {Record<string, object>} [o.byHead] Work 브랜치 내보내기의 head마다 묶음(되먹임의 결과를 센다)
 */
export function deviceMetrics({
  events,
  rec,
  contract = null,
  finals = [],
  all = [],
  byHead = {},
}) {
  return {
    modern: Array.isArray(rec?.exports),
    exports: Array.isArray(rec?.exports) ? rec.exports.length : 1,
    units: unitsOf(contract),
    delivery: contract?.delivery ?? null,
    missingExports: ofType(events, 'export_missing').length,
    end: endMetrics(events),
    feedback: { ...feedbackMetrics(events), outcomes: feedbackOutcomes(events, byHead) },
    probe: probeMetrics(events),
    examples: examplesMetrics(all, finals),
    raises: raiseMetrics(all, finals),
  }
}

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/**
 * 결과 폴더에 남긴 Work(<실행>/works/<Work 이름>/: episode.mjs가 앱의 Work 폴더와 마지막 증거 묶음 evidence.json을 옮긴 것)에서
 * 장치 지표를 다시 센다. run.json에 devices가 없는 예전 결과(M2)를 다시 모을 때 쓴다. 남긴 묶음은 내보내기마다 마지막 것뿐이라
 * (Work 브랜치는 evidence.json, 단위 브랜치는 evidence/unit-<단위>.json) head마다의 묶음은 그것만 본다. work.json이 없으면 null
 * @param {string} dir 남긴 Work 폴더
 */
export function savedDevices(dir) {
  const rec = readJson(path.join(dir, 'work.json'))
  if (!rec) return null
  let events = []
  try {
    events = fs
      .readFileSync(path.join(dir, 'events.jsonl'), 'utf8')
      .split('\n')
      .filter((l) => l.trim())
      .flatMap((l) => {
        try {
          return [JSON.parse(l)]
        } catch {
          return [] // 쓰는 중인 줄
        }
      })
  } catch {
    // 기록이 없으면 빈 것이다
  }
  const units = Array.isArray(rec.exports) ? rec.exports.map((x) => x?.unit ?? null) : [null]
  const finals = units.map((unit) => ({
    unit,
    bundle: readJson(
      unit === null
        ? path.join(dir, 'evidence.json')
        : path.join(dir, 'evidence', `unit-${unit}.json`),
    ),
  }))
  const main = finals.find((x) => x.unit === null)?.bundle
  return deviceMetrics({
    events,
    rec,
    contract: readJson(path.join(dir, 'contract.json')),
    finals,
    all: finals.map((x) => x.bundle).filter(Boolean),
    byHead: typeof main?.head === 'string' ? { [main.head]: main } : {},
  })
}
