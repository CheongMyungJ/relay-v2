// [파일] 탭의 트리 표시와 연 파일 탭 (D490~D492). DOM을 쓰지 않아 [단위]로 지킨다. 렌더러는 core를 부르지 못해(I167)
// 트리의 차례는 core/files의 sortEntries와 같은 규칙으로 여기에 둔다.
import type { FileChangeView, FileEntryView } from '../../shared/views'

export type ChangeStatus = FileChangeView['status']

/** 트리의 항목. deleted는 Work가 지워 디스크에 없고 바뀐 파일 목록에만 있는 것이다 (D490) */
export interface TreeEntry extends FileEntryView {
  deleted?: boolean
}

/** 바뀐 파일의 표시: 파일마다의 상태와, 아래에 바뀐 파일이 있는 폴더의 상태 */
export interface ChangeMarks {
  files: ReadonlyMap<string, ChangeStatus>
  dirs: ReadonlyMap<string, ChangeStatus>
}

/** 폴더의 상태: 아래가 모두 더한 것이면 A, 모두 지운 것이면 D, 섞였으면 M이다 */
function merge(a: ChangeStatus | undefined, b: ChangeStatus): ChangeStatus {
  return a === undefined || a === b ? b : 'M'
}

export function changeMarks(changes: readonly FileChangeView[]): ChangeMarks {
  const files = new Map<string, ChangeStatus>()
  const dirs = new Map<string, ChangeStatus>()
  for (const c of changes) {
    files.set(c.path, c.status)
    for (let i = c.path.indexOf('/'); i > 0; i = c.path.indexOf('/', i + 1)) {
      const dir = c.path.slice(0, i)
      dirs.set(dir, merge(dirs.get(dir), c.status))
    }
  }
  return { files, dirs }
}

const rank = (e: FileEntryView) => (e.kind === 'dir' ? 0 : 1)

/** 폴더 먼저, 그다음 이름 순(대소문자 무시, 숫자는 크기로). core/files의 sortEntries와 같다 */
function compare(a: FileEntryView, b: FileEntryView): number {
  return (
    rank(a) - rank(b) ||
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }) ||
    (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
  )
}

/**
 * 폴더 하나의 항목에 Work가 지운 것을 더한다 (D490). 지운 파일과, 지운 파일만 남은(디스크에 없는) 폴더가 그 자리에
 * 보인다. 디스크에 같은 이름이 있으면 더하지 않는다
 */
export function withDeleted(
  dir: string,
  entries: readonly FileEntryView[],
  changes: readonly FileChangeView[],
): TreeEntry[] {
  const present = new Set(entries.map((e) => e.name))
  const prefix = dir ? `${dir}/` : ''
  const ghosts = new Map<string, TreeEntry>()
  for (const c of changes) {
    if (c.status !== 'D' || !c.path.startsWith(prefix)) continue
    const rest = c.path.slice(prefix.length)
    const slash = rest.indexOf('/')
    const name = slash < 0 ? rest : rest.slice(0, slash)
    if (!name || present.has(name) || ghosts.has(name)) continue
    ghosts.set(name, { name, kind: slash < 0 ? 'file' : 'dir', deleted: true })
  }
  if (ghosts.size === 0) return [...entries]
  return [...entries, ...ghosts.values()].sort(compare)
}

/** 경로를 담은 폴더들. 바깥부터다: `a/b/c.md` → `a`, `a/b` */
export function parentDirs(file: string): string[] {
  const out: string[] = []
  for (let i = file.indexOf('/'); i > 0; i = file.indexOf('/', i + 1)) out.push(file.slice(0, i))
  return out
}

/** 경로의 마지막 이름 */
export function baseName(file: string): string {
  return file.slice(file.lastIndexOf('/') + 1)
}

/**
 * 같은 이름의 탭이 여럿이면 그 탭에 붙일 폴더 (D492). 겹치지 않으면 빈 글이다. 겹치는 탭끼리 갈리는 데까지 위로 올라간다:
 * `src/a/index.ts`와 `src/b/index.ts`는 `a`와 `b`, `index.ts`(worktree 바로 아래)는 `./`다
 */
export function tabHints(paths: readonly string[]): string[] {
  const names = paths.map(baseName)
  return paths.map((p, i) => {
    const others = paths.filter((q, j) => j !== i && names[j] === names[i])
    if (others.length === 0) return ''
    const dirs = (x: string) => parentDirs(x).map((d) => baseName(d))
    const mine = dirs(p)
    for (let depth = 1; depth <= mine.length; depth++) {
      const tail = mine.slice(-depth).join('/')
      if (others.every((q) => dirs(q).slice(-depth).join('/') !== tail)) return tail
    }
    return mine.length ? mine.join('/') : './'
  })
}

/** 탭을 닫은 뒤 고를 탭: 닫은 것이 지금 탭이면 오른쪽, 없으면 왼쪽 이웃이다 */
export function afterClose(
  tabs: readonly string[],
  current: string | null,
  closed: string,
): string | null {
  if (current !== closed) return current
  const i = tabs.indexOf(closed)
  if (i < 0) return current
  return tabs[i + 1] ?? tabs[i - 1] ?? null
}
