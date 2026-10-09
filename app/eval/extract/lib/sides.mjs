// 평가의 쪽(지침 판). 쪽마다 run 종류·렌즈별로 지시의 층을 정하고, 조립은 앱과 같은 skills/extract/run.mjs로 한다(16.3).
// 쪽 이름은 조립본 해시다(결정 19): 이름 뒤에 그 쪽이 넘기는 모든 지시·스키마 바이트의 해시를 붙인다.
//
// base: 최소 지시 판(결정 19). 종류마다 한 문단짜리 과제 설명(sides/base/<kind>.md)과, 스키마 원본의 설명에서 기계로
//   렌더링한 필드 안내(L3)만 준다. 고정 계약(L1), 종류 절차(L2), 렌즈 카드의 점검표 밖 절(L2b)은 없다. 결과 스키마는
//   다른 쪽과 같다(16.6 초안 점검표 포함). L3를 넣는 까닭은 AI 결정 49.
// v1: 첫 지침 판. 제품의 원본(skills/extract/contract.md, kinds/<kind>.md, 렌즈 카드의 trace 절)을 앱과 같은 load.mjs로
//   읽어 그대로 준다. 필드 안내(L3)와 결과 스키마는 base와 같아, 두 쪽의 차이는 L1·L2·L2b 문구뿐이다.
import fs from 'node:fs'
import path from 'node:path'
import { buildRun, sha256 } from '../../../../skills/extract/run.mjs'
import { loadBase, loadChecklist, loadLayers } from '../../../../skills/extract/load.mjs'

const HERE = path.join(import.meta.dirname, '..', 'sides')
const read = (...p) => fs.readFileSync(path.join(HERE, ...p), 'utf8')

export const SIDES = {
  base: {
    describe: '최소 지시 판(결정 19): 한 문단 과제 설명 + 필드 안내(L3)',
    layers: (kind) => ({ kind: read('base', `${kind}.md`) }),
  },
  v1: {
    describe:
      '첫 지침 판: L1 고정 계약, L2 종류 절차, L2b 렌즈 카드(skills/extract) + 필드 안내(L3)',
    layers: (kind, lens) => loadLayers(kind, lens),
  },
  // 층 빼기(7차 작업): v1의 어느 층이 재현율을 떨어뜨렸는지 가른다. 필드 안내(L3)와 스키마는 모두 같다
  'abl-l1': {
    describe: '층 빼기: L1 고정 계약만(+ base의 한 문단 과제 설명)',
    layers: (kind, lens) => ({
      contract: loadLayers(kind, lens).contract,
      kind: read('base', `${kind}.md`),
    }),
  },
  'abl-l2': {
    describe: '층 빼기: L2 종류 절차와 렌즈 카드만(L1 없음)',
    layers: (kind, lens) => {
      const { kind: k, lens: l } = loadLayers(kind, lens)
      return { kind: k, lens: l }
    },
  },
}

/**
 * 쪽 하나의 (종류, 렌즈) 조립본. more는 결과 스키마에 넣을 칸의 키다: integrate는 관점(coverage), review는 질문·서술 키
 * (answers, verdicts). survey·trace는 more가 없어 바이트가 예전과 같다(AI 결정 108)
 */
export function buildSide(name, kind, lens, more = {}) {
  const side = SIDES[name]
  if (!side) throw new Error(`모르는 쪽: ${name} (있는 쪽: ${Object.keys(SIDES).join(', ')})`)
  return buildRun({
    base: loadBase(kind),
    checklist: lens ? loadChecklist(lens) : null,
    layers: side.layers(kind, lens),
    more,
  })
}

/** 쪽 이름에 넣을 조합: [kind, lens, more] 가운데 같은 것은 처음 하나만, 차례는 그대로 */
export function sideEntries(entries) {
  const seen = new Set()
  return entries.filter(([k, l, more]) => {
    const key = `${k}|${l ?? ''}|${JSON.stringify(more ?? {})}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * 쪽 이름: 이름-<조립본 해시 8자>. entries는 [kind, lens, more?] 목록이다. more(칸 키)가 다르면 스키마 바이트가 달라
 * 해시에 든다. survey·trace는 more가 없어 이름이 예전과 같다
 */
export function sideId(name, entries) {
  const all = entries
    .map(([k, l, more]) => buildSide(name, k, l, more ?? {}))
    .map((b) => `${b.hashes.instructions}\n${b.hashes.schema}`)
    .join('\n')
  return `${name}-${sha256(all).slice(7, 15)}`
}
