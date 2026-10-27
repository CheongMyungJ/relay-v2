// 유형 설정 (5.6.15, D506, D509~D511): Work의 유형 정의와 그 설정. 기본 유형의 정의는 shared/builtin-types의 표이고(원본은
// skills/types/), 커스텀 유형은 Work를 만들 때 복사한 custom_type이다. 기본 유형의 Work는 이 정의와 앱에 든 절차로 돈다
// (복사하지 않는다, D515)
import { BUILTIN_TYPES } from '../shared/builtin-types'
import type { CustomTypeDef, TypeTarget, WorkState } from '../shared/work'
import { checkMethodOf, targetOf } from './custom-type'
import { workType } from './pipeline'

export { BUILTIN_ARTIFACT_NAMES, BUILTIN_TYPES, CUSTOM_REQUEST_HINT } from '../shared/builtin-types'

type DefWork = Pick<WorkState, 'type' | 'custom_type'>

/**
 * Work의 유형 정의 (D506): 기본 유형은 BUILTIN_TYPES, 커스텀 유형은 만들 때 복사한 custom_type이다. 커스텀인데 기록이
 * 없으면(깨진 기록) null이다
 */
export function typeDefOf(work: DefWork): CustomTypeDef | null {
  const type = workType(work)
  return type === 'custom' ? (work.custom_type ?? null) : BUILTIN_TYPES[type]
}

/** Work 유형의 확인 방법 설정 (D509). 기록이 깨진 커스텀은 지금까지처럼 켬이다 */
export function checkMethodOn(work: DefWork): boolean {
  const def = typeDefOf(work)
  return def ? checkMethodOf(def) : true
}

/** Work 유형의 대상 (D510) */
export function typeTarget(work: DefWork): TypeTarget {
  const def = typeDefOf(work)
  return def ? targetOf(def) : 'code'
}

/**
 * 공용 스킬의 설정 구간(`<!-- if: … -->`)을 고르는 표시 (5.6.15, D508): 대상(code / document), 확인 방법(check-method /
 * no-check-method), 커스텀 유형인지(custom / builtin)
 */
export function assemblyFlags(work: DefWork): string[] {
  return [
    typeTarget(work),
    checkMethodOn(work) ? 'check-method' : 'no-check-method',
    workType(work) === 'custom' ? 'custom' : 'builtin',
  ]
}

/** 유형 설정 구간의 표시 이름 (5.6.15) */
export const ASSEMBLY_FLAGS: readonly string[] = [
  'code',
  'document',
  'check-method',
  'no-check-method',
  'custom',
  'builtin',
]
