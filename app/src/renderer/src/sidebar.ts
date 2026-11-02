// 사이드바의 목록 구성. 프로젝트마다 그 Work를 두고, 아카이브로 옮긴 보관된 Work는 프로젝트들과 같은 계층의
// 공통 아카이브 하나에 모은다. 기본 세션 묶음, 프로젝트, 아카이브는 따로 접는다 (D380, D381, D405).
import type { WorkView } from '../../shared/views'

/** 접은 표시의 아카이브 키. 프로젝트 id와 겹치지 않는다 */
export const ARCHIVE_GROUP = '@archive'

/** 접은 표시의 기본 세션 묶음 키 (D405) */
export const SESSIONS_GROUP = '@sessions'

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
  for (const [id, list] of byProject) byProject.set(id, nestChildren(list))
  return { byProject, archive }
}

/**
 * 자식 Work를 부모 바로 아래에 둔다 (D549): 부모는 지금 차례대로, 자식은 그 부모 아래에 만든 차례대로. 부모가 이 목록에 없으면
 * (아카이브로 옮겼거나 지웠으면) 제자리에 둔다
 */
export function nestChildren(list: readonly WorkView[]): WorkView[] {
  const keys = new Set(list.map((w) => w.key))
  const children = new Map<string, WorkView[]>()
  for (const w of list) {
    const parent = w.parent?.key
    if (parent && keys.has(parent)) children.set(parent, [...(children.get(parent) ?? []), w])
  }
  const out: WorkView[] = []
  for (const w of list) {
    if (w.parent && keys.has(w.parent.key)) continue
    out.push(w)
    out.push(...(children.get(w.key) ?? []).sort((a, b) => a.workId.localeCompare(b.workId)))
  }
  return out
}

/** 그룹 하나를 접거나 편 집합 */
export function toggled(collapsed: ReadonlySet<string>, group: string): ReadonlySet<string> {
  const next = new Set(collapsed)
  if (!next.delete(group)) next.add(group)
  return next
}

/**
 * 등록된 프로젝트와 아카이브, 기본 세션 묶음만 남긴다. 지운 프로젝트를 같은 경로로 다시 등록하면 id가 같아(폴더 이름과 경로의
 * 해시) 접힌 채로 나오지 않게 한다. 바뀐 것이 없으면 같은 집합을 돌려준다
 */
export function pruned(
  collapsed: ReadonlySet<string>,
  projectIds: readonly string[],
): ReadonlySet<string> {
  const keep = new Set([...projectIds, ARCHIVE_GROUP, SESSIONS_GROUP])
  const next = new Set([...collapsed].filter((k) => keep.has(k)))
  return next.size === collapsed.size ? collapsed : next
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
