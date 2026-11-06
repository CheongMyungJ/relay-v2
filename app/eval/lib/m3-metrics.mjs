// relay-v3 M3 장치(docs/m3-design.md: M3a 지식 잇기, M3b 빚 기록, M3c 곁들일 정리)의 지표. 앱을 부르지 않고 앱이 남긴
// 파일에서 센다(설계의 '장치 몫의 지표는 work.json m3, request.md, 묶음, groundings, ledger.jsonl, events.jsonl에서 센다'):
//   work.json: m3(Work를 만들 때의 스위치), unrecorded(기록 안 된 나빠짐), end_memos(V37)
//   request.md 끝에 relay가 붙인 절: '## 관련 지식 (relay가 고름)', '## 기록 안 된 나빠짐 (relay가 찾음)', '## 이 레포의 빚 (relay가 읽음)'
//   증거 묶음: knowledge {changed, issues}, debt_commit {from, items}, debt_covered {ratchets, items}, tidy {taken, items, lines, max},
//     groundings(근거 knowledge의 확인)
//   events.jsonl: debt_recorded {from, head, items, push}, ended {how, memos}
//   ledger.jsonl(앱 저장소): merged_head, by, accepted {ratchets, debt}(내보내기마다 마지막 줄, core acceptedUnrecorded)
//   최종 레포: .relay/debt/*.md(머리글 kind), docs/knowledge/**/*.md
import fs from 'node:fs'
import path from 'node:path'
import { listFiles } from './structure.mjs'

/** relay가 request.md 끝에 붙이는 절(relay-v3 engine/judge.ts RELAY_SECTIONS)의 제목과 지표 이름 */
export const REQUEST_SECTIONS = {
  knowledge: '## 관련 지식 (relay가 고름)',
  unrecorded: '## 기록 안 된 나빠짐 (relay가 찾음)',
  debt: '## 이 레포의 빚 (relay가 읽음)',
}

/**
 * request.md에서 relay가 붙인 절마다 목록 항목('- '로 시작하는 줄) 수. 절이 없으면 null(장치가 꺼졌거나 붙일 것이 없음).
 * 절은 있는데 항목이 없으면 0이다(겹치는 지식이 없다는 한 줄 등)
 */
export function requestSections(text) {
  const lines = String(text ?? '').split('\n')
  const out = {}
  for (const [key, title] of Object.entries(REQUEST_SECTIONS)) {
    const at = lines.findIndex((l) => l.trim() === title)
    if (at < 0) {
      out[key] = null
      continue
    }
    let n = 0
    for (let i = at + 1; i < lines.length && !/^## /.test(lines[i]); i++)
      if (/^\s*[-*] /.test(lines[i])) n++
    out[key] = n
  }
  return out
}

const count = (xs, pred) => (Array.isArray(xs) ? xs.filter(pred).length : 0)
const len = (xs) => (Array.isArray(xs) ? xs.length : 0)

/** 근거 확인(groundings: { line, ground, ok, detail }) 가운데 knowledge 근거의 수와 head에서 찾은 수(ok) */
export function knowledgeGroundings(bundle) {
  const all = (bundle?.groundings ?? []).filter((g) => g?.ground?.type === 'knowledge')
  return { total: all.length, found: count(all, (g) => g.ok === true) }
}

/**
 * relay-v3 Work 하나의 M3 지표. rec는 work.json, events는 events.jsonl의 기록, request는 request.md의 글, final은 Work 브랜치
 * 내보내기의 마지막 묶음(없으면 null), all은 이 Work에서 잰 묶음들이다
 */
export function m3WorkMetrics({ rec, events = [], request = '', final = null, all = [] }) {
  const recorded = events.filter((e) => e?.type === 'debt_recorded')
  const issues = final?.knowledge?.issues ?? []
  return {
    switches: rec?.m3 ?? null,
    unrecorded: Array.isArray(rec?.unrecorded) ? rec.unrecorded.length : null,
    request: requestSections(request),
    knowledge: final?.knowledge
      ? {
          changed: len(final.knowledge.changed),
          format: count(issues, (i) => i?.kind === 'format'),
          anchor: count(issues, (i) => i?.kind === 'anchor'),
          notYet: count(issues, (i) => i?.kind === 'not_yet'),
        }
      : null,
    groundings: knowledgeGroundings(final),
    debt: {
      recorded: recorded.length,
      items: recorded.reduce((a, e) => a + len(e.items), 0),
      pushed: count(recorded, (e) => e.push === true),
      commit: final?.debt_commit ? len(final.debt_commit.items) : null,
      covered: final?.debt_covered ? len(final.debt_covered.items) : null,
      // 이 Work에서 잰 묶음 가운데 나빠진 래칫이 있던 것(빚을 물을 거리)
      worseBundles: count(all, (b) => (b?.ratchets ?? []).some((r) => r?.status === 'worse')),
      finalWorse: (final?.ratchets ?? []).filter((r) => r?.status === 'worse').map((r) => r.id),
    },
    tidy: final?.tidy
      ? {
          taken: len(final.tidy.taken),
          items: len(final.tidy.items),
          lines: final.tidy.lines ?? null,
          max: final.tidy.max ?? null,
        }
      : null,
    memos: len(rec?.end_memos),
  }
}

/** ledger.jsonl의 글을 줄로. 깨진 줄은 건너뛴다 */
export function parseLedger(text) {
  const out = []
  for (const line of String(text ?? '').split('\n')) {
    if (!line.trim()) continue
    try {
      out.push(JSON.parse(line))
    } catch {
      // 쓰다 끊긴 줄
    }
  }
  return out
}

const exportKey = (e) => JSON.stringify([e.work, e.export ?? null])

/**
 * 실적 장부의 M3b 지표(relay-v3 core/ledger.ts acceptedUnrecorded와 같은 셈): accepted는 받아들인 나빠짐이 있는 내보내기 수
 * (내보내기마다 마지막으로 받아들인 줄), recorded는 그 가운데 빚을 기록한 것(debt가 비지 않음), unrecorded는 기록하지 않은 것.
 * merged는 머지된 내보내기 수(마지막 merged_head가 있는 것)와 누가 했는지. works를 주면 그 Work id의 줄만 센다
 */
export function ledgerMetrics(entries, works = null) {
  const own = works ? entries.filter((e) => works.includes(e.work)) : entries
  const last = new Map()
  const merged = new Map()
  for (const e of own) {
    if (e?.accepted) last.set(exportKey(e), (e.accepted.debt ?? []).length > 0)
    if (e?.merged_head) merged.set(exportKey(e), e.by ?? null)
  }
  const by = {}
  for (const v of merged.values()) by[v ?? '?'] = (by[v ?? '?'] ?? 0) + 1
  const recorded = [...last.values()].filter(Boolean).length
  return {
    lines: own.length,
    accepted: last.size,
    recorded,
    unrecorded: last.size - recorded,
    merged: merged.size,
    mergedBy: by,
  }
}

/** 레포 폴더의 빚 장부와 지식 파일 수. 빚은 머리글의 kind마다 */
export function repoM3(root) {
  const files = listFiles(root)
  const debt = files.filter((f) => /^\.relay\/debt\/[^/]+\.md$/.test(f))
  const kinds = {}
  for (const f of debt) {
    const m = /^kind:\s*(\S+)/m.exec(fs.readFileSync(path.join(root, f), 'utf8'))
    const k = m ? m[1].replace(/^"|"$/g, '') : '?'
    kinds[k] = (kinds[k] ?? 0) + 1
  }
  return {
    debt: { items: debt.length, kinds },
    knowledge: files.filter((f) => /^docs\/knowledge\/.+\.md$/.test(f)).length,
    quality: files.includes('.relay/quality.json'),
  }
}
