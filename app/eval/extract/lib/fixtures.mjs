// 손으로 쓴 정답 결과(reference/<과제>.json)와 함정(traps/*.json)을 읽는다. 채점기의 시험(app/eval/test/extract.test.mjs)이
// 쓴다: reference는 만점이어야 하고, 함정은 reference에 작은 변경(ops)을 더해 해당 지표에서 잡혀야 한다(결정 21).
import fs from 'node:fs'
import path from 'node:path'

export function readReference(scenarioDir, task) {
  const f = (s) =>
    JSON.parse(fs.readFileSync(path.join(scenarioDir, 'reference', `${task}${s}.json`), 'utf8'))
  return { out: f(''), judge: f('.judge') }
}

export function readTraps(scenarioDir) {
  const dir = path.join(scenarioDir, 'traps')
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({
      name: f.replace(/\.json$/, ''),
      ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')),
    }))
}

function walk(obj, p) {
  const parts = p.split('.')
  const last = parts.pop()
  let cur = obj
  for (const k of parts) cur = cur[/^\d+$/.test(k) ? Number(k) : k]
  return [cur, /^\d+$/.test(last) ? Number(last) : last]
}

/** ops를 차례로 더한 복사본 */
export function applyOps(out, ops) {
  const copy = structuredClone(out)
  for (const o of ops) {
    if (o.op === 'push') {
      const [parent, key] = walk(copy, o.path)
      parent[key].push(structuredClone(o.value))
    } else {
      const [parent, key] = walk(copy, o.path)
      if (o.op === 'set') parent[key] = structuredClone(o.value)
      else if (o.op === 'remove' && Array.isArray(parent)) parent.splice(key, 1)
      else throw new Error(`모르는 op: ${o.op} (remove는 배열 원소만)`)
    }
  }
  return copy
}

/** reference 판정 답에 함정의 판정 덮어쓰기({ recall: { id: {...} } })를 더한다 */
export function mergeJudge(base, override = {}) {
  const out = structuredClone(base)
  for (const list of ['recall', 'must_not', 'resolvable']) {
    for (const [id, v] of Object.entries(override[list] ?? {})) {
      const i = out[list].findIndex((x) => x.id === id)
      if (i >= 0) out[list][i] = { id, ...v }
      else out[list].push({ id, ...v })
    }
  }
  return out
}
