// 자식 Work의 판정 (docs/design.md D543~D548). 자율 Work의 자율 진행이 나란히 코드를 바꿀 일을 자식 Work로 맡긴다. 만들기와
// 진행은 main/children이 하고, 여기는 상한과 겹침, 끝났는지만 정한다
import type { WorkStatus } from '../shared/work'

/** 한 Work의 자식 수 상한 (D545, (기본값)). 포기한 자식은 세지 않는다 */
export const MAX_CHILDREN = 5

/**
 * 정하지 않은 자식인가 (D548): 진행 중이거나 멈춘 자식이다. 완료(merge), PR 진행(pr), 포기(discard), 보관은 정한 것이다. 부모는
 * 정하지 않은 자식이 남아 있으면 마무리하지 못한다
 */
export function isOpenChild(status: WorkStatus): boolean {
  return status === 'active' || status === 'stopped'
}

/** 경로를 비교할 모양으로: 앞의 ./와 끝의 /를 떼고 구분자는 /로 */
const norm = (p: string) => p.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '')

/** 같은 파일이거나 한쪽이 다른 쪽을 담는 폴더인가 */
const overlaps = (a: string, b: string) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)

/**
 * 새 자식이 맡는 파일과 나란히 도는 다른 자식이 맡는 파일의 겹침 (D545). 막지 않고 경고로 알린다: 합칠 때 부모가 충돌을 푼다
 */
export function childOverlap(
  files: readonly string[],
  others: readonly { work: string; files: readonly string[] }[],
): { work: string; files: string[] }[] {
  const mine = files.map(norm).filter(Boolean)
  return others
    .map((o) => ({
      work: o.work,
      files: o.files.map(norm).filter((f) => mine.some((m) => overlaps(m, f))),
    }))
    .filter((o) => o.files.length > 0)
}

/** 부모가 마무리할 때 정하지 않은 자식이 남은 오류 (D548) */
export function openChildrenIssue(open: readonly string[]): string {
  return `정하지 않은 자식 Work가 있음: ${open.join(', ')}. decide_child로 merge, pr, discard 가운데 하나를 정한 뒤 마무리하세요 (D548)`
}
