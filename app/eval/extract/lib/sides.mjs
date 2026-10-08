// 평가의 쪽(지침 판). 쪽마다 run 종류·렌즈별로 지시의 층을 정하고, 조립은 앱과 같은 skills/extract/run.mjs로 한다(16.3).
// 쪽 이름은 조립본 해시다(결정 19): 이름 뒤에 그 쪽이 넘기는 모든 지시·스키마 바이트의 해시를 붙인다.
//
// base: 최소 지시 판(결정 19). 종류마다 한 문단짜리 과제 설명(sides/base/<kind>.md)과, 스키마 원본의 설명에서 기계로
//   렌더링한 필드 안내(L3)만 준다. 고정 계약(L1), 종류 절차(L2), 렌즈 카드의 점검표 밖 절(L2b)은 없다. 결과 스키마는
//   다른 쪽과 같다(16.6 초안 점검표 포함). L3를 넣는 까닭은 AI 결정 49.
import fs from 'node:fs'
import path from 'node:path'
import { buildRun, sha256 } from '../../../../skills/extract/run.mjs'
import { loadBase, loadChecklist } from '../../../../skills/extract/load.mjs'

const HERE = path.join(import.meta.dirname, '..', 'sides')
const read = (...p) => fs.readFileSync(path.join(HERE, ...p), 'utf8')

export const SIDES = {
  base: {
    describe: '최소 지시 판(결정 19): 한 문단 과제 설명 + 필드 안내(L3)',
    layers: (kind) => ({ kind: read('base', `${kind}.md`) }),
  },
}

/** 쪽 하나의 (종류, 렌즈) 조립본 */
export function buildSide(name, kind, lens) {
  const side = SIDES[name]
  if (!side) throw new Error(`모르는 쪽: ${name} (있는 쪽: ${Object.keys(SIDES).join(', ')})`)
  return buildRun({
    base: loadBase(kind),
    checklist: lens ? loadChecklist(lens) : null,
    layers: side.layers(kind, lens),
  })
}

/** 쪽 이름: 이름-<조립본 해시 8자>. combos는 [kind, lens] 목록 */
export function sideId(name, combos) {
  const all = combos
    .map(([k, l]) => buildSide(name, k, l))
    .map((b) => `${b.hashes.instructions}\n${b.hashes.schema}`)
    .join('\n')
  return `${name}-${sha256(all).slice(7, 15)}`
}
