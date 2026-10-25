// 옛 파이프라인의 Work (D501). verify가 있는 파이프라인을 보는 시험이 쓴다: 새 Work는 pipeline: 2로 만들어지므로 그 표시를 뗀다.
import type { WorkState } from '../../src/shared/work'

/** pipeline 표시를 뗀 Work: 끝에 verify가 있는 옛 파이프라인으로 돈다 (D501) */
export function legacy(work: WorkState): WorkState {
  const rest = { ...work }
  delete rest.pipeline
  return rest
}
