// 사이드바의 목록 구성. 프로젝트마다 그 Work를 두고, 아카이브로 옮긴 보관된 Work는 프로젝트들과 같은 계층의
// 공통 아카이브 하나에 모은다. 프로젝트와 아카이브는 따로 접는다.
import type { WorkView } from '../../shared/views'

/** 접은 표시의 아카이브 키. 프로젝트 id와 겹치지 않는다 */
export const ARCHIVE_GROUP = '@archive'

export interface SidebarGroups {
  /** 프로젝트 id별 Work. 아카이브로 옮긴 Work는 빠진다 */
  byProject: Map<string, WorkView[]>
  /** 아카이브로 옮긴 Work */
  archive: WorkView[]
}

/** 최근 Work가 앞에 오게 나눈다 */
export function sidebarGroups(works: readonly WorkView[]): SidebarGroups {
  const newest = [...works].sort((a, b) => b.workId.localeCompare(a.workId))
  const byProject = new Map<string, WorkView[]>()
  const archive: WorkView[] = []
  for (const w of newest) {
    if (w.shelved) {
      archive.push(w)
      continue
    }
    const list = byProject.get(w.projectId) ?? []
    list.push(w)
    byProject.set(w.projectId, list)
  }
  return { byProject, archive }
}

/** 우클릭 메뉴에 [아카이브로 옮기기]를 보이는 Work: 보관됐고 아직 옮기지 않았다 */
export function canShelve(w: WorkView): boolean {
  return w.status === 'archived' && !w.shelved
}

/** 그룹 하나를 접거나 편 집합 */
export function toggled(collapsed: ReadonlySet<string>, group: string): ReadonlySet<string> {
  const next = new Set(collapsed)
  if (!next.delete(group)) next.add(group)
  return next
}

const STORAGE_KEY = 'relay.sidebar.collapsed'

/** 접은 그룹을 읽는다. 저장소를 쓸 수 없거나 값이 없으면 모두 펼친다 */
export function loadCollapsed(): ReadonlySet<string> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return new Set(Array.isArray(raw) ? raw.filter((k) => typeof k === 'string') : [])
  } catch {
    return new Set()
  }
}

export function saveCollapsed(collapsed: ReadonlySet<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...collapsed]))
  } catch {
    // 저장하지 못하면 이번 실행에서만 접는다
  }
}
